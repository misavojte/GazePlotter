import { describe, it, expect } from 'vitest'
import { prepareScanpath, SIMILARITY } from '../src/lib/metrics/core/scanpathSimilarity'

/** The textbook dynamic programs the bit-parallel kernels must equal exactly. */
function levenshteinDp(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    for (let j = 1; j <= b.length; j++) {
      curr[j] =
        a[i - 1] === b[j - 1] ? prev[j - 1] : Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + 1)
    }
    prev = curr
  }
  return prev[b.length]
}

/** ScanGraph Needleman-Wunsch: match +1, mismatch -1, gap 0. */
function needlemanWunschDp(a: string, b: string): number {
  let prev = new Array<number>(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    const curr = [0]
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.max(prev[j - 1] + (a[i - 1] === b[j - 1] ? 1 : -1), prev[j], curr[j - 1])
    }
    prev = curr
  }
  return prev[b.length]
}

function rng(seed: number) {
  let s = seed >>> 0
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 0x100000000)
}

// Lengths around the 32-letter word boundaries, plus random ones.
const EDGE_LENGTHS = [0, 1, 2, 31, 32, 33, 63, 64, 65, 96, 97, 130]

function randomScanpath(rnd: () => number, length: number, alphabet: number): string {
  let s = ''
  for (let i = 0; i < length; i++) {
    const k = Math.floor(rnd() * alphabet)
    s += k === alphabet - 1 && alphabet > 2 ? '#' : String.fromCharCode(65 + k)
  }
  return s
}

describe('bit-parallel scanpath kernels equal the dynamic programs', () => {
  const rnd = rng(42)
  const pairs: [string, string][] = []
  for (const la of EDGE_LENGTHS) {
    for (const lb of EDGE_LENGTHS) {
      const alphabet = 1 + Math.floor(rnd() * 12)
      pairs.push([randomScanpath(rnd, la, alphabet), randomScanpath(rnd, lb, alphabet)])
    }
  }
  for (let t = 0; t < 2000; t++) {
    const alphabet = 1 + Math.floor(rnd() * 12)
    pairs.push([
      randomScanpath(rnd, Math.floor(rnd() * 160), alphabet),
      randomScanpath(rnd, Math.floor(rnd() * 160), alphabet),
    ])
  }
  // Near-identical pairs: the high-similarity end matters most for ScanGraph.
  for (let t = 0; t < 300; t++) {
    const a = randomScanpath(rnd, 20 + Math.floor(rnd() * 120), 6)
    const chars = a.split('')
    for (let e = 0; e < 3; e++) chars[Math.floor(rnd() * chars.length)] = 'Z'
    pairs.push([a, chars.join('')])
  }

  it('Levenshtein', () => {
    for (const [a, b] of pairs) {
      const maxLen = Math.max(a.length, b.length)
      const expected = maxLen === 0 ? NaN : 1 - levenshteinDp(a, b) / maxLen
      expect(SIMILARITY.levenshtein(prepareScanpath(a), prepareScanpath(b)), `${a} | ${b}`).toBe(expected)
    }
  })

  it('Needleman-Wunsch', () => {
    for (const [a, b] of pairs) {
      const maxLen = Math.max(a.length, b.length)
      const expected = maxLen === 0 ? NaN : needlemanWunschDp(a, b) / maxLen
      expect(SIMILARITY.needlemanWunsch(prepareScanpath(a), prepareScanpath(b)), `${a} | ${b}`).toBe(expected)
    }
  })
})
