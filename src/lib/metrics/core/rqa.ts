/**
 * Recurrence Quantification Analysis (RQA) primitives.
 *
 * Everything needed to compute RQA scalars and visualize recurrence plots:
 *   • scalar metrics directly from a categorical fixation sequence;
 *   • line masks for highlighting diagonal / horizontal / vertical runs.
 *
 * Consumers (sequence metrics, recurrence plot) import from here. Nothing in
 * this file depends on the plot layer.
 */

export type RqaMeasure = 'REC' | 'DET' | 'LAM'

/**
 * One RQA scalar of a categorical sequence (e.g. AOI slots), where two
 * positions recur iff they share a category. Only the upper triangle counts
 * (i < j), and no N x N matrix is built:
 *   • R, the recurrent pairs, is a count per category;
 *   • DET compares the sequence with itself shifted by each offset;
 *   • LAM sums runs of one category, since a row's horizontal lines are the
 *     later runs of its own category (its own run cut at the row) and a
 *     column's vertical lines the earlier ones.
 * Returns NaN when N < 2 (no pairs), and `scalarOnNoRecurrence` (default NaN)
 * when R = 0, the zero denominator of DET and LAM. REC callers pass 0, since
 * 0 recurrences is a 0% rate.
 */
export function rqaScalar(
  seq: readonly number[],
  minLineLength: number,
  measure: RqaMeasure,
  scalarOnNoRecurrence: number = Number.NaN,
): number {
  const N = seq.length
  if (N < 2) return Number.NaN
  const R = recurrentPairs(seq)
  if (R === 0) return scalarOnNoRecurrence
  if (measure === 'REC') return (200 * R) / (N * (N - 1))
  if (measure === 'DET') return (100 * diagonalLinePoints(seq, minLineLength)) / R
  return (100 * (lineRunPoints(seq, minLineLength, 'after') + lineRunPoints(seq, minLineLength, 'before'))) / (2 * R)
}

function recurrentPairs(seq: readonly number[]): number {
  const counts = new Map<number, number>()
  for (const c of seq) counts.set(c, (counts.get(c) ?? 0) + 1)
  let R = 0
  for (const k of counts.values()) R += (k * (k - 1)) / 2
  return R
}

/** Points on diagonal lines of length ≥ L: offset k pairs i with i + k. */
function diagonalLinePoints(seq: readonly number[], L: number): number {
  const N = seq.length
  let count = 0
  for (let k = 1; k < N; k++) {
    let run = 0
    for (let i = 0; i + k < N; i++) {
      if (seq[i] === seq[i + k]) run++
      else {
        if (run >= L) count += run
        run = 0
      }
    }
    if (run >= L) count += run
  }
  return count
}

/**
 * Points on horizontal ('after': row i, its category's runs at j > i) or
 * vertical ('before': column j, runs at i < j) lines of length ≥ L. A run of
 * length n contributes n × (qualifying runs of its category on the far side)
 * for its rows, plus its own cut part: lengths 0 .. n - 1, those ≥ L.
 */
function lineRunPoints(seq: readonly number[], L: number, side: 'after' | 'before'): number {
  const N = seq.length
  const qualifying = new Map<number, number>()
  let total = 0
  let s = side === 'after' ? N - 1 : 0
  const step = side === 'after' ? -1 : 1
  while (s >= 0 && s < N) {
    const c = seq[s]
    let n = 0
    while (s >= 0 && s < N && seq[s] === c) {
      n++
      s += step
    }
    const far = qualifying.get(c) ?? 0
    total += n * far + (n - 1 >= L ? ((n - 1 + L) * (n - L)) / 2 : 0)
    if (n >= L) qualifying.set(c, far + n)
  }
  return total
}

// ─── Line masks (used for recurrence-plot highlighting) ─────────────────────

/** Mark cells on diagonal lines of length ≥ L (upper triangle). */
export function buildDiagonalLineMask(matrix: Uint8Array, N: number, L: number): Uint8Array {
  const mask = new Uint8Array(N * N)
  for (let k = 1; k < N; k++) {
    let runStart = -1
    let runLength = 0
    for (let i = 0; i + k < N; i++) {
      const j = i + k
      if (matrix[i * N + j]) {
        if (runLength === 0) runStart = i
        runLength++
      } else {
        if (runLength >= L) {
          for (let s = runStart; s < runStart + runLength; s++) mask[s * N + (s + k)] = 1
        }
        runLength = 0
      }
    }
    if (runLength >= L) {
      for (let s = runStart; s < runStart + runLength; s++) mask[s * N + (s + k)] = 1
    }
  }
  return mask
}

/** Mark cells on horizontal lines of length ≥ L (upper triangle). */
export function buildHorizontalLineMask(matrix: Uint8Array, N: number, L: number): Uint8Array {
  const mask = new Uint8Array(N * N)
  for (let i = 0; i < N - 1; i++) {
    let runStart = -1
    let runLength = 0
    const rowOffset = i * N
    for (let j = i + 1; j < N; j++) {
      if (matrix[rowOffset + j]) {
        if (runLength === 0) runStart = j
        runLength++
      } else {
        if (runLength >= L) {
          for (let s = runStart; s < runStart + runLength; s++) mask[rowOffset + s] = 1
        }
        runLength = 0
      }
    }
    if (runLength >= L) {
      for (let s = runStart; s < runStart + runLength; s++) mask[rowOffset + s] = 1
    }
  }
  return mask
}

/** Mark cells on vertical lines of length ≥ L (upper triangle). */
export function buildVerticalLineMask(matrix: Uint8Array, N: number, L: number): Uint8Array {
  const mask = new Uint8Array(N * N)
  for (let j = 1; j < N; j++) {
    let runStart = -1
    let runLength = 0
    for (let i = 0; i < j; i++) {
      if (matrix[i * N + j]) {
        if (runLength === 0) runStart = i
        runLength++
      } else {
        if (runLength >= L) {
          for (let s = runStart; s < runStart + runLength; s++) mask[s * N + j] = 1
        }
        runLength = 0
      }
    }
    if (runLength >= L) {
      for (let s = runStart; s < runStart + runLength; s++) mask[s * N + j] = 1
    }
  }
  return mask
}
