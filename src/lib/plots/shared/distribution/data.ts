import {
  createAdaptiveTimeline,
  type AdaptiveTimeline,
} from '$lib/plots/shared/timelineUtils'
import type { CategoryDistribution } from './types'

/**
 * One sort policy for every plot rendering a distribution. Any `orderBy` other
 * than `'value'` — including an unset one — keeps the caller's category order
 * ('aoi', 'type', ...), reversed for desc.
 */
export function applySorting(
  data: CategoryDistribution[],
  orderBy: 'value' | (string & {}) | undefined,
  orderDirection: 'asc' | 'desc'
): CategoryDistribution[] {
  if (orderBy !== 'value') {
    return orderDirection === 'asc' ? data : [...data].reverse()
  }
  return [...data].sort((a, b) =>
    orderDirection === 'asc' ? a.value - b.value : b.value - a.value
  )
}

/**
 * The distribution's value-axis policy — nice timeline from the data max, with
 * `scaleRange`'s zero-means-unset overrides and the +1 floor guard. Shared so
 * the plots cannot drift on scale semantics.
 */
export function valueAxisTimeline(
  dataMax: number,
  scaleRange: [number, number] | undefined
): AdaptiveTimeline {
  let timelineMin = 0
  let timelineMax = dataMax || 100
  if (scaleRange) {
    if (scaleRange[0] !== 0) timelineMin = scaleRange[0]
    if (scaleRange[1] !== 0) timelineMax = scaleRange[1]
  }
  if (timelineMax <= timelineMin) timelineMax = timelineMin + 1
  return createAdaptiveTimeline(timelineMin, timelineMax, 6)
}
