import type { CorrelationMethod } from '../types'

/**
 * Mathematical minimum below which a coefficient is degenerate/undefined (n<3
 * forces |r|=1 or 0/0). This is the FLOOR FOR COMPUTING a number, not the floor
 * for DISPLAYING one — the statistical-soundness display floor is
 * `MIN_CORRELATION_SAMPLES` in const.ts, applied by the transformer, so these
 * pure functions stay testable at small n.
 */
const MIN_COMPUTABLE_SAMPLES = 3

export interface CorrelationOutcome {
  r: number | null
  n: number
}

/**
 * Computes Pearson correlation coefficient over paired samples.
 * Pairs where either value is NaN (used here as the missing-data sentinel)
 * are dropped before the count is taken. Returns r=null when either the
 * effective n is below the computable minimum or either vector is constant
 * (zero variance — correlation is mathematically undefined there).
 */
export function pearson(xs: readonly number[], ys: readonly number[]): CorrelationOutcome {
  if (xs.length !== ys.length) {
    throw new Error('pearson: input vectors must have equal length')
  }

  let n = 0
  let sumX = 0
  let sumY = 0
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i]
    const y = ys[i]
    if (Number.isNaN(x) || Number.isNaN(y)) continue
    sumX += x
    sumY += y
    n++
  }

  if (n < MIN_COMPUTABLE_SAMPLES) return { r: null, n }

  const meanX = sumX / n
  const meanY = sumY / n

  let num = 0
  let denomX = 0
  let denomY = 0
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i]
    const y = ys[i]
    if (Number.isNaN(x) || Number.isNaN(y)) continue
    const dx = x - meanX
    const dy = y - meanY
    num += dx * dy
    denomX += dx * dx
    denomY += dy * dy
  }

  if (denomX === 0 || denomY === 0) return { r: null, n }

  return { r: num / Math.sqrt(denomX * denomY), n }
}

/**
 * Computes Spearman rank correlation by ranking both vectors (with fractional
 * ranking for ties) and applying Pearson to the ranks. Missing pairs (NaN on
 * either side) are dropped before ranking.
 */
export function spearman(xs: readonly number[], ys: readonly number[]): CorrelationOutcome {
  if (xs.length !== ys.length) {
    throw new Error('spearman: input vectors must have equal length')
  }

  const cleanX: number[] = []
  const cleanY: number[] = []
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i]
    const y = ys[i]
    if (Number.isNaN(x) || Number.isNaN(y)) continue
    cleanX.push(x)
    cleanY.push(y)
  }

  if (cleanX.length < MIN_COMPUTABLE_SAMPLES) {
    return { r: null, n: cleanX.length }
  }

  return pearson(rank(cleanX), rank(cleanY))
}

export function correlate(
  xs: readonly number[],
  ys: readonly number[],
  method: CorrelationMethod
): CorrelationOutcome {
  return method === 'spearman' ? spearman(xs, ys) : pearson(xs, ys)
}

/**
 * Fractional ranking — ties receive the mean of the ranks they span.
 * Returns a parallel array of ranks aligned with the input.
 */
export function rank(values: readonly number[]): number[] {
  const n = values.length
  const indexed = new Array<{ value: number; index: number }>(n)
  for (let i = 0; i < n; i++) {
    indexed[i] = { value: values[i], index: i }
  }
  indexed.sort((a, b) => a.value - b.value)

  const ranks = new Array<number>(n)
  let i = 0
  while (i < n) {
    let j = i
    while (j + 1 < n && indexed[j + 1].value === indexed[i].value) {
      j++
    }
    const meanRank = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) {
      ranks[indexed[k].index] = meanRank
    }
    i = j + 1
  }
  return ranks
}
