import { percentileSorted } from '$lib/shared/stats'
import type { SummaryStatistics } from './types'

/**
 * The one stats bundle every distribution slot is summarised by, whatever the
 * category axis is (AOIs, eye-movement types, ...). Boxplot whiskers follow the
 * standard 1.5*IQR rule, clamped to observed values; anything past them is an
 * outlier the figure draws individually.
 */
export function computeSummaryStatistics(values: number[]): SummaryStatistics {
  const empty: SummaryStatistics = {
    mean: 0,
    median: 0,
    q1: 0,
    q3: 0,
    min: 0,
    max: 0,
    sd: 0,
    sem: 0,
    whiskerLow: 0,
    whiskerHigh: 0,
    count: 0,
    outliers: [],
  }

  if (values.length === 0) return empty

  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length

  let sum = 0
  for (let i = 0; i < n; i++) sum += sorted[i]
  const mean = sum / n

  const median =
    n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)]

  const q1 = percentileSorted(sorted, 0.25)
  const q3 = percentileSorted(sorted, 0.75)

  const min = sorted[0]
  const max = sorted[n - 1]

  let sumSqDiff = 0
  for (let i = 0; i < n; i++) {
    const diff = sorted[i] - mean
    sumSqDiff += diff * diff
  }
  const sd = n > 1 ? Math.sqrt(sumSqDiff / (n - 1)) : 0
  const sem = n > 0 ? sd / Math.sqrt(n) : 0

  const iqr = q3 - q1
  const whiskerLowBound = q1 - 1.5 * iqr
  const whiskerHighBound = q3 + 1.5 * iqr

  let whiskerLow = min
  for (let i = 0; i < n; i++) {
    if (sorted[i] >= whiskerLowBound) {
      whiskerLow = sorted[i]
      break
    }
  }

  let whiskerHigh = max
  for (let i = n - 1; i >= 0; i--) {
    if (sorted[i] <= whiskerHighBound) {
      whiskerHigh = sorted[i]
      break
    }
  }

  const outliers: number[] = []
  for (let i = 0; i < n; i++) {
    if (sorted[i] < whiskerLow || sorted[i] > whiskerHigh) {
      outliers.push(sorted[i])
    }
  }

  return {
    mean,
    median,
    q1,
    q3,
    min,
    max,
    sd,
    sem,
    whiskerLow,
    whiskerHigh,
    count: n,
    outliers,
  }
}
