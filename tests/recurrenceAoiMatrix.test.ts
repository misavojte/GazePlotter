import { describe, it, expect } from 'vitest'
import { buildAoiMatrix } from '../src/lib/plots/recurrence/core/collector'
import type { FixationRecord } from '../src/lib/plots/recurrence/types'

// `buildAoiMatrix` was rewritten from a nested `aoiIds.some(a => other.includes(a))`
// scan to a per-fixation bitmask + bitwise-AND shared test. These tests pin the
// new implementation to the EXACT output of the original algorithm (kept here as
// a reference), across randomized inputs and the boundary cases that the bitmask
// representation is sensitive to: empty membership, the bit-31 sign boundary, and
// AOI ids that spill past 32 into multiple mask words.

/** The original O(N^2) some/includes implementation, verbatim, as the oracle. */
function referenceAoiMatrix(fixations: FixationRecord[], N: number): Uint8Array {
  const matrix = new Uint8Array(N * N)
  for (let i = 0; i < N; i++) {
    matrix[i * N + i] = 1
    if (fixations[i].aoiIds.length === 0) continue
    const rowOffset = i * N
    for (let j = i + 1; j < N; j++) {
      if (fixations[j].aoiIds.length === 0) continue
      const shared = fixations[i].aoiIds.some(aoi =>
        fixations[j].aoiIds.includes(aoi)
      )
      if (shared) {
        matrix[rowOffset + j] = 1
        matrix[j * N + i] = 1
      }
    }
  }
  return matrix
}

const fix = (aoiIds: number[]): FixationRecord => ({
  x: 0,
  y: 0,
  duration: 0,
  aoiIds,
})

function build(fixations: FixationRecord[]): Uint8Array {
  const N = fixations.length
  const matrix = new Uint8Array(N * N)
  buildAoiMatrix(fixations, matrix, N)
  return matrix
}

function expectMatchesReference(fixations: FixationRecord[]): void {
  const N = fixations.length
  expect(Array.from(build(fixations))).toEqual(
    Array.from(referenceAoiMatrix(fixations, N))
  )
}

describe('buildAoiMatrix bitmask equivalence', () => {
  it('handles trivial sizes (0, 1, 2 fixations)', () => {
    expectMatchesReference([])
    expectMatchesReference([fix([0])])
    expectMatchesReference([fix([0]), fix([0])]) // shared
    expectMatchesReference([fix([0]), fix([1])]) // not shared
  })

  it('a fixation with no AOIs never recurs off-diagonal', () => {
    const fixations = [fix([]), fix([2]), fix([]), fix([2])]
    const m = build(fixations)
    expectMatchesReference(fixations)
    // diagonal always set
    for (let i = 0; i < 4; i++) expect(m[i * 4 + i]).toBe(1)
    // the two empty fixations share with nobody
    for (let j = 0; j < 4; j++) {
      if (j !== 0) expect(m[0 * 4 + j]).toBe(0)
      if (j !== 2) expect(m[2 * 4 + j]).toBe(0)
    }
    // 1 and 3 both hold AOI 2 -> recur
    expect(m[1 * 4 + 3]).toBe(1)
    expect(m[3 * 4 + 1]).toBe(1)
  })

  it('respects the bit-31 sign boundary and the 32-bit word boundary', () => {
    // id 31 lands on the sign bit of word 0; id 32 is the first bit of word 1.
    const fixations = [
      fix([31]),
      fix([31]), // shares with 0 (same sign-bit)
      fix([32]),
      fix([32]), // shares with 2 (same word-1 bit)
      fix([31, 32]), // shares with all of the above
    ]
    expectMatchesReference(fixations)
    const m = build(fixations)
    expect(m[0 * 5 + 1]).toBe(1) // 31 & 31
    expect(m[2 * 5 + 3]).toBe(1) // 32 & 32
    expect(m[0 * 5 + 2]).toBe(0) // 31 vs 32 -> different words, no share
    expect(m[4 * 5 + 0]).toBe(1)
    expect(m[4 * 5 + 2]).toBe(1)
  })

  it('handles AOI ids spanning several mask words (> 64)', () => {
    const fixations = [fix([0, 70]), fix([70]), fix([3]), fix([69, 200])]
    expectMatchesReference(fixations)
    const m = build(fixations)
    expect(m[0 * 4 + 1]).toBe(1) // share id 70 (word 2)
    expect(m[0 * 4 + 2]).toBe(0) // 0,70 vs 3 -> no share
    expect(m[0 * 4 + 3]).toBe(0) // 0,70 vs 69,200 -> no share
  })

  it('matches the reference across randomized trials (incl. multi-word)', () => {
    // Deterministic LCG so any failure is reproducible.
    let seed = 0x1234abcd
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 0x100000000
    }
    const pick = (n: number) => Math.floor(rnd() * n)

    for (let trial = 0; trial < 400; trial++) {
      const N = pick(40)
      // Vary the AOI universe so some trials stay single-word (<=32) and others
      // force the multi-word path (ids up to ~80).
      const universe = 1 + pick(80)
      const fixations: FixationRecord[] = []
      for (let i = 0; i < N; i++) {
        const k = pick(5) // 0..4 AOIs per fixation, including empties
        const ids: number[] = []
        for (let c = 0; c < k; c++) ids.push(pick(universe))
        fixations.push(fix(ids))
      }
      expectMatchesReference(fixations)
    }
  })
})
