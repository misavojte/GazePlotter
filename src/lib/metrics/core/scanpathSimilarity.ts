/**
 * Pairwise similarity kernels for AOI-letter scanpaths.
 *
 * Levenshtein: edit distance normalized to 0-1 similarity.
 * Needleman-Wunsch: ScanGraph scoring (match +1, gap 0, mismatch -1),
 * score / max length — the parameter p of Dolezalova & Popelka (2016).
 *
 * Both run bit-parallel over 32 letters of one scanpath per machine word, so a
 * pair costs ⌈|a| / 32⌉ × |b| word steps instead of |a| × |b| cells. Results
 * equal the textbook dynamic programs exactly; tests pin them against those.
 */

export type SimilarityMethod = 'levenshtein' | 'needlemanWunsch'

/** A scanpath ready for comparison, built once and reused for every pair: its
 *  letters, and per letter the bit mask of the positions holding it. */
export interface PreparedScanpath {
  readonly codes: Uint16Array
  readonly words: number
  readonly masks: ReadonlyMap<number, Uint32Array>
  /** All-zero mask, for a letter this scanpath never holds. */
  readonly none: Uint32Array
}

export function prepareScanpath(scanpath: string): PreparedScanpath {
  const words = Math.max(1, Math.ceil(scanpath.length / 32))
  const codes = new Uint16Array(scanpath.length)
  const masks = new Map<number, Uint32Array>()
  for (let i = 0; i < scanpath.length; i++) {
    const code = scanpath.charCodeAt(i)
    codes[i] = code
    let mask = masks.get(code)
    if (!mask) masks.set(code, (mask = new Uint32Array(words)))
    mask[i >>> 5] |= 1 << (i & 31)
  }
  return { codes, words, masks, none: new Uint32Array(words) }
}

// Two reusable word vectors; a kernel call never allocates.
let vecA = new Uint32Array(64)
let vecB = new Uint32Array(64)
function reserve(words: number): void {
  if (vecA.length >= words) return
  vecA = new Uint32Array(words * 2)
  vecB = new Uint32Array(words * 2)
}

function popcount(x: number): number {
  x -= (x >>> 1) & 0x55555555
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333)
  return Math.imul((x + (x >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24
}

/**
 * Unit-cost edit distance (Myers 1999, in Hyyrö's block form). Per letter of
 * `b`, each 32-row block of `a` updates its vertical delta vectors from the
 * horizontal delta entering at its top (+1 at row 0, as D[0][j] = j). The
 * distance is tracked at the last row of `a`; bits above it in the last block
 * never reach lower bits, since additions and shifts only move upwards.
 */
function editDistance(a: PreparedScanpath, b: PreparedScanpath): number {
  const m = a.codes.length
  const n = b.codes.length
  if (m === 0) return n
  if (n === 0) return m
  const words = a.words
  reserve(words)
  const Pv = vecA
  const Mv = vecB
  Pv.fill(0xffffffff, 0, words)
  Mv.fill(0, 0, words)
  const lastBit = (m - 1) & 31
  let score = m
  for (let j = 0; j < n; j++) {
    const Eq = a.masks.get(b.codes[j]) ?? a.none
    let hin = 1
    for (let k = 0; k < words; k++) {
      let eq = Eq[k]
      const pv = Pv[k]
      const mv = Mv[k]
      const xv = eq | mv
      if (hin < 0) eq |= 1
      const xh = ((((eq & pv) >>> 0) + pv) ^ pv) | eq
      let ph = mv | ~(xh | pv)
      let mh = pv & xh
      const bit = k === words - 1 ? lastBit : 31
      const hout = ((ph >>> bit) & 1) - ((mh >>> bit) & 1)
      ph <<= 1
      mh <<= 1
      if (hin < 0) mh |= 1
      else if (hin > 0) ph |= 1
      Pv[k] = mh | ~(xv | ph)
      Mv[k] = ph & xv
      hin = hout
    }
    score += hin
  }
  return score
}

/**
 * Longest common subsequence length (Allison & Dix 1986, as in Hyyrö 2004):
 * V starts all ones; per letter of `b`, V = (V + (V & M)) | (V & ~M), the
 * addition carrying across words. The LCS is the number of zero bits of V
 * among the |a| low bits.
 *
 * It is the ScanGraph Needleman-Wunsch score: with gap 0 and mismatch -1, two
 * gaps always beat a mismatch, so an optimal alignment has none and scores its
 * matches, a common subsequence.
 */
function lcsLength(a: PreparedScanpath, b: PreparedScanpath): number {
  const m = a.codes.length
  if (m === 0 || b.codes.length === 0) return 0
  const words = a.words
  reserve(words)
  const V = vecA
  V.fill(0xffffffff, 0, words)
  for (let j = 0; j < b.codes.length; j++) {
    const M = a.masks.get(b.codes[j])
    if (!M) continue
    let carry = 0
    for (let k = 0; k < words; k++) {
      const v = V[k]
      const sum = v + ((v & M[k]) >>> 0) + carry
      carry = sum > 0xffffffff ? 1 : 0
      V[k] = sum | (v & ~M[k])
    }
  }
  let ones = 0
  for (let k = 0; k < words; k++) ones += popcount(V[k])
  // The spare high bits of the last word stay ones: M is 0 there, so each step
  // ORs the old ones back in, whatever carries arrive.
  return m - (ones - (words * 32 - m))
}

/** The shorter scanpath along the bits: fewer words per step. Both scores are symmetric. */
const ordered = (a: PreparedScanpath, b: PreparedScanpath) =>
  a.codes.length <= b.codes.length ? [a, b] : [b, a]

/** Normalized Levenshtein similarity (0-1, where 1 = identical). Two EMPTY
 *  scanpaths are 0/0 — no data to compare, not identical strategies — so the
 *  pair carries no value: NaN renders as a missing cell and never forms an
 *  edge or clique. One-sided emptiness stays formula-defined (p = 0). */
function levenshteinSimilarity(a: PreparedScanpath, b: PreparedScanpath): number {
  const maxLen = Math.max(a.codes.length, b.codes.length)
  if (maxLen === 0) return NaN
  const [short, long] = ordered(a, b)
  return 1 - editDistance(short, long) / maxLen
}

/** Normalized Needleman-Wunsch similarity (0-1, where 1 = identical). Both
 *  empty is 0/0 — see {@link levenshteinSimilarity}. The score is in
 *  [0, min(|a|,|b|)], so score/maxLen is in [0, 1], 1 only for identical strings. */
function needlemanWunschSimilarity(a: PreparedScanpath, b: PreparedScanpath): number {
  const maxLen = Math.max(a.codes.length, b.codes.length)
  if (maxLen === 0) return NaN
  const [short, long] = ordered(a, b)
  return lcsLength(short, long) / maxLen
}

/** The pair score per method, for `pairMatrix` over prepared scanpaths. */
export const SIMILARITY: Record<SimilarityMethod, (a: PreparedScanpath, b: PreparedScanpath) => number> = {
  levenshtein: levenshteinSimilarity,
  needlemanWunsch: needlemanWunschSimilarity,
}
