/**
 * Starter coverage.
 *
 * A recipe nobody seeds is invisible from a fresh workspace: it exists, it is
 * tested, and it is reachable only by opening the metric library and building
 * an instance by hand. That is a legitimate choice for some metrics and an
 * oversight for others, and nothing in the codebase currently records which is
 * which — `transitionDwellSum` says so in its own definition file, the other
 * two say nothing at all.
 *
 * This forces the distinction to be written down. A new recipe fails here
 * until it is either seeded in `STARTING_METRICS` or listed below with a
 * reason.
 */
import { describe, it, expect } from 'vitest'
import '../src/lib/metrics' // side effect: registers every recipe
import { listMetrics } from '../src/lib/metrics/core/defineMetric'
import { STARTING_METRICS } from '../src/lib/metrics/startingMetrics'

/** Recipes deliberately absent from a fresh workspace. Each value is the reason. */
const UNSEEDED: Record<string, string> = {
  transitionDwellSum:
    'documented in its definition: transitionDwellMean is the conventional reading, raw totals are added by hand',
}

const seededBaseIds = (): Set<string> =>
  new Set(STARTING_METRICS.map(s => s.baseId))

describe('starter coverage', () => {
  it('every registered recipe is seeded or recorded as deliberately unseeded', () => {
    const seeded = seededBaseIds()
    const unrecorded = listMetrics()
      .map(m => m.meta.id)
      .filter(id => !seeded.has(id) && !(id in UNSEEDED))
    expect(unrecorded).toEqual([])
  })

  it('the unseeded list has no stale entries', () => {
    const seeded = seededBaseIds()
    expect(Object.keys(UNSEEDED).filter(id => seeded.has(id))).toEqual([])
  })

  it('every starter references a registered recipe', () => {
    const known = new Set(listMetrics().map(m => m.meta.id))
    expect(STARTING_METRICS.map(s => s.baseId).filter(id => !known.has(id))).toEqual([])
  })
})
