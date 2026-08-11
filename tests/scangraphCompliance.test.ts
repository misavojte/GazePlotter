import { describe, it, expect } from 'vitest'
import { computeSimilarityMatrix } from '../src/lib/metrics/core/scanpathSimilarity'
import {
  scangraphCliques,
  thresholdForEdgeShare,
} from '../src/lib/plots/scanpath-similarity/core/transformer'
import { maximalCliques } from '../src/lib/plots/scanpath-similarity/core/cliques'
import { generateScanGraph } from '../src/lib/data/export/mappers/scangraph'
import { makeTestEngine } from './helpers/testEngine'
import type { DataEngine } from '../src/lib/data/engine/dataEngine.svelte'
import type { ScanpathSimilarityData } from '../src/lib/plots/scanpath-similarity/types'

/** Pins to the ScanGraph paper (Dolezalova & Popelka, JEMR 2016). */

const offDiagonal = (m: number[]) => m[1]

describe('similarity kernels — paper example "gravitation" vs "gravidity"', () => {
  it('Levenshtein: distance 5, p = 1 - 5/11 = 0.545', () => {
    const m = computeSimilarityMatrix(['gravitation', 'gravidity'], 'levenshtein')
    expect(offDiagonal(m)).toBe(0.545)
  })

  it('Needleman-Wunsch (match +1, gap 0, mismatch -1): score 6, p = 6/11 = 0.545', () => {
    const m = computeSimilarityMatrix(['gravitation', 'gravidity'], 'needlemanWunsch')
    expect(offDiagonal(m)).toBe(0.545)
  })

  it('NW: identical strings 1, disjoint alphabets 0', () => {
    expect(offDiagonal(computeSimilarityMatrix(['ABAB', 'ABAB'], 'needlemanWunsch'))).toBe(1)
    expect(offDiagonal(computeSimilarityMatrix(['AAAA', 'BBBB'], 'needlemanWunsch'))).toBe(0)
  })

  it('NW: subsequence pair scores min/max length', () => {
    // ABC inside ABCDEF: score 3, maxLen 6.
    expect(offDiagonal(computeSimilarityMatrix(['ABC', 'ABCDEF'], 'needlemanWunsch'))).toBe(0.5)
  })

  it('both-empty pairs carry no value; one-sided emptiness scores 0', () => {
    for (const method of ['levenshtein', 'needlemanWunsch'] as const) {
      expect(offDiagonal(computeSimilarityMatrix(['', ''], method))).toBeNaN()
      expect(offDiagonal(computeSimilarityMatrix(['', 'ABC'], method))).toBe(0)
    }
  })
})

const simDataFor = (pairSims: number[][], labels: string[]): ScanpathSimilarityData => {
  const size = labels.length
  const matrix = new Float64Array(size * size)
  for (let i = 0; i < size; i++) {
    matrix[i * size + i] = 1
    for (let j = i + 1; j < size; j++) {
      matrix[i * size + j] = pairSims[i][j]
      matrix[j * size + i] = pairSims[i][j]
    }
  }
  return { labels, participantIds: labels.map((_, i) => i), matrix, size }
}

describe('thresholdForEdgeShare — the paper\'s percentage-of-edges graph', () => {
  // Pair sims for 3 participants: (0,1)=0.9, (0,2)=0.5, (1,2)=0.2.
  const three = simDataFor(
    [
      [0, 0.9, 0.5],
      [0, 0, 0.2],
    ],
    ['a', 'b', 'c']
  )

  it('cuts at the requested share of pairs', () => {
    expect(thresholdForEdgeShare(three, 100)).toBe(0.2)
    expect(thresholdForEdgeShare(three, 67)).toBe(0.5)
    expect(thresholdForEdgeShare(three, 34)).toBe(0.9)
  })

  it('0% (or too small a share for one pair) draws no edges', () => {
    expect(thresholdForEdgeShare(three, 0)).toBe(Infinity)
    expect(thresholdForEdgeShare(three, 33)).toBe(Infinity) // floor(0.99) = 0
  })

  it('ties crossing the cut round DOWN (fewer edges), per the paper', () => {
    // 4 participants, 6 pairs: 0.9, 0.5, 0.5, 0.5, 0.2, 0.1.
    const four = simDataFor(
      [
        [0, 0.9, 0.5, 0.5],
        [0, 0, 0.5, 0.2],
        [0, 0, 0, 0.1],
      ],
      ['a', 'b', 'c', 'd']
    )
    // 50% wants 3 edges; taking any 0.5 takes all three -> step up to 0.9.
    expect(thresholdForEdgeShare(four, 50)).toBe(0.9)
    // 67% wants 4: the 0.5 tie fits entirely.
    expect(thresholdForEdgeShare(four, 67)).toBe(0.5)
  })

  it('all-tied sims below the wanted share yield no edges', () => {
    const tied = simDataFor(
      [
        [0, 0.5, 0.5],
        [0, 0, 0.5],
      ],
      ['a', 'b', 'c']
    )
    expect(thresholdForEdgeShare(tied, 34)).toBe(Infinity)
    expect(thresholdForEdgeShare(tied, 100)).toBe(0.5)
  })

  it('NaN pairs (both scanpaths empty) count in neither numerator nor denominator', () => {
    // 3 pairs, one of them NaN -> 2 comparable pairs; 50% of 2 = 1 edge.
    const withNaN = simDataFor(
      [
        [0, NaN, 0.9],
        [0, 0, 0.4],
      ],
      ['a', 'b', 'c']
    )
    expect(thresholdForEdgeShare(withNaN, 50)).toBe(0.9)
    expect(thresholdForEdgeShare(withNaN, 100)).toBe(0.4)
  })
})

describe('maximalCliques — the paper\'s groups of similar participants', () => {
  const links = (pairs: [number, number][]) =>
    pairs.map(([source, target]) => ({ source, target, value: 1 }))

  it('finds overlapping maximal cliques, largest first', () => {
    // Triangle 0-1-2 with a pendant 2-3.
    expect(maximalCliques(4, links([[0, 1], [0, 2], [1, 2], [2, 3]]))).toEqual([
      [0, 1, 2],
      [2, 3],
    ])
  })

  it('a chordless square is four 2-cliques, not one 4-clique', () => {
    expect(maximalCliques(4, links([[0, 1], [1, 2], [2, 3], [0, 3]]))).toEqual([
      [0, 1],
      [0, 3],
      [1, 2],
      [2, 3],
    ])
  })

  it('isolated vertices never form cliques; empty graph has none', () => {
    expect(maximalCliques(3, links([[0, 1]]))).toEqual([[0, 1]])
    expect(maximalCliques(3, [])).toEqual([])
  })

  it('a complete graph is one clique', () => {
    expect(
      maximalCliques(4, links([[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]]))
    ).toEqual([[0, 1, 2, 3]])
  })

  it('cliques carry internal agreement: weakest and mean pairwise p', () => {
    // Triangle a-b-c (0.9, 0.8, 0.7) with a pendant c-d (0.6).
    const simData = simDataFor(
      [
        [0, 0.9, 0.8, 0.2],
        [0, 0, 0.7, 0.2],
        [0, 0, 0, 0.6],
      ],
      ['a', 'b', 'c', 'd']
    )
    const cliques = scangraphCliques(simData, 0.5)!
    expect(cliques.map(c => c.key)).toEqual(['0-1-2', '2-3'])
    expect(cliques[0].minSimilarity).toBe(0.7)
    expect(cliques[0].meanSimilarity).toBe(0.8)
    expect(cliques[1].minSimilarity).toBe(0.6)
    expect(cliques[1].meanSimilarity).toBe(0.6)
  })
})

describe('generateScanGraph — OGAMA round-trip contract', () => {
  // Stimulus 1. P0: fixation in AOI 1, a saccade (category 1, must not be
  // encoded), fixation in AOI 2. P1: two fixations in AOI 1, one outside.
  const engine = makeTestEngine(
    [
      [],
      [
        [
          [0, 100, 0, 1],
          [100, 150, 1, 1],
          [150, 250, 0, 2],
        ],
        [
          [0, 100, 0, 1],
          [100, 200, 0, 1],
          [200, 300, 0],
        ],
      ],
    ],
    { aoiMapping: 'group' }
  ) as unknown as DataEngine

  it('emits CRLF-only rows with the column header at row index 8', () => {
    const text = generateScanGraph(engine, 1, false)
    expect(text).toContain('# Contents: Similarity Measurements of scanpaths.')
    // CRLF is the only line break — a mixed-endings file folds the header
    // block into one row and the ingest's headerRowId 8 misses.
    expect(text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
    const rows = text.split('\r\n')
    expect(rows[8]).toBe('Sequence Similarity\tScanpath string')
  })

  it('encodes fixations only, with the metric encoder letters', () => {
    const rows = generateScanGraph(engine, 1, false).split('\r\n')
    expect(rows[9]).toBe('P0\tAB')
    expect(rows[10]).toBe('P1\tAA#')
    expect(rows[4]).toBe('# # = no fixation, A = AOI 1, B = AOI 2')
  })

  it('collapsed folds consecutive same-AOI fixations', () => {
    const rows = generateScanGraph(engine, 1, true).split('\r\n')
    expect(rows[10]).toBe('P1\tA#')
  })
})
