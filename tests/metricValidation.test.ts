/**
 * Tests for the central validation function `recipeSupports`. The rules are:
 *
 *   - `aggregate-aoi` (across an aoi-vector): only extremes (`max`/`min`) —
 *     blanket statistical rule — and only where the recipe NAMES the extreme's
 *     meaning in its `aoiAggregate` declaration (an unnamed extreme has no
 *     defined reading, e.g. on metrics carrying a Summary `statistic`).
 *   - `matrix-aggregate` (across cells): `max | min` by default;
 *     `extensive`-class recipes get the full `sum | mean | max | min`.
 *   - Windowing gated by `supportsWindowing`.
 *   - Slot refs must be non-negative.
 *   - Raw-shape compatibility is enforced via the leaf registry.
 */
import { describe, it, expect } from 'vitest'
import '../src/lib/metrics/init'
import { recipeSupports } from '../src/lib/metrics/core/validation'
import { getMetric, getRecipe, listMetrics } from '../src/lib/metrics/core/defineMetric'
import type { Projection } from '../src/lib/metrics/core/projection'

function recipe(id: string) {
  const r = getRecipe(id)
  if (!r) throw new Error(`Recipe "${id}" not found — check registration order.`)
  return r
}

/** Recipes that NAME both extremes in their `aoiAggregate` declaration. */
const NAMED_EXTREMES = [
  'absoluteTime',
  'relativeTime',
  'fixationCount',
  'visitCount',
  'fixated',
  'timeToFirstFixation',
]
/** Recipes that deliberately leave `aoiAggregate` undeclared (no defined
 *  reading — the duration metrics' Summary `statistic` would double-reduce). */
const UNNAMED_EXTREMES = ['fixationDuration', 'visitDuration', 'firstFixationDuration']

describe('aggregate-aoi: extremes only, and only where the recipe names their meaning', () => {
  it.each(NAMED_EXTREMES)(
    '%s rejects mean across AOIs (biased by AOI segmentation)',
    (id) => {
      const p: Projection = { kind: 'aggregate-aoi', reducer: 'mean' }
      expect(recipeSupports(recipe(id), p)).not.toBe(true)
    },
  )
  it.each(NAMED_EXTREMES)(
    '%s rejects sum across AOIs',
    (id) => {
      const p: Projection = { kind: 'aggregate-aoi', reducer: 'sum' }
      expect(recipeSupports(recipe(id), p)).not.toBe(true)
    },
  )
  it.each(NAMED_EXTREMES)(
    '%s rejects median across AOIs',
    (id) => {
      const p: Projection = { kind: 'aggregate-aoi', reducer: 'median' }
      expect(recipeSupports(recipe(id), p)).not.toBe(true)
    },
  )
  it.each(NAMED_EXTREMES)(
    '%s accepts min across AOIs (named)',
    (id) => {
      const p: Projection = { kind: 'aggregate-aoi', reducer: 'min' }
      expect(recipeSupports(recipe(id), p)).toBe(true)
    },
  )
  it.each(NAMED_EXTREMES)(
    '%s accepts max across AOIs (named)',
    (id) => {
      const p: Projection = { kind: 'aggregate-aoi', reducer: 'max' }
      expect(recipeSupports(recipe(id), p)).toBe(true)
    },
  )
  it.each(UNNAMED_EXTREMES)(
    '%s rejects max AND min across AOIs (no named meaning)',
    (id) => {
      expect(recipeSupports(recipe(id), { kind: 'aggregate-aoi', reducer: 'max' })).not.toBe(true)
      expect(recipeSupports(recipe(id), { kind: 'aggregate-aoi', reducer: 'min' })).not.toBe(true)
    },
  )
})

describe('matrix-aggregate: additive opt-in', () => {
  it('rejects matrix-aggregate mean on transitionProbability (non-additive)', () => {
    const r = recipe('transitionProbability')
    const p: Projection = { kind: 'matrix-aggregate', reducer: 'mean' }
    expect(recipeSupports(r, p)).not.toBe(true)
  })
  it('rejects matrix-aggregate sum on transitionProbability (non-additive)', () => {
    const r = recipe('transitionProbability')
    const p: Projection = { kind: 'matrix-aggregate', reducer: 'sum' }
    expect(recipeSupports(r, p)).not.toBe(true)
  })
  it('rejects matrix-aggregate mean on transitionRelativeFrequency (non-additive)', () => {
    const r = recipe('transitionRelativeFrequency')
    const p: Projection = { kind: 'matrix-aggregate', reducer: 'mean' }
    expect(recipeSupports(r, p)).not.toBe(true)
  })
  it('rejects matrix-aggregate mean on transitionDwellMean (non-additive)', () => {
    const r = recipe('transitionDwellMean')
    const p: Projection = { kind: 'matrix-aggregate', reducer: 'mean' }
    expect(recipeSupports(r, p)).not.toBe(true)
  })
  it('accepts matrix-aggregate sum on transitionCount (additive)', () => {
    const r = recipe('transitionCount')
    const p: Projection = { kind: 'matrix-aggregate', reducer: 'sum' }
    expect(recipeSupports(r, p)).toBe(true)
  })
  it('accepts matrix-aggregate mean on transitionCount (additive)', () => {
    const r = recipe('transitionCount')
    const p: Projection = { kind: 'matrix-aggregate', reducer: 'mean' }
    expect(recipeSupports(r, p)).toBe(true)
  })
  it('accepts matrix-cell on probability recipes (specific transition)', () => {
    const r = recipe('transitionProbability')
    const p: Projection = {
      kind: 'matrix-cell',
      fromAoi: { by: 'name', name: 'A' },
      toAoi:   { by: 'name', name: 'B' },
    }
    expect(recipeSupports(r, p)).toBe(true)
  })
  it('accepts matrix-aggregate max on any matrix recipe', () => {
    expect(recipeSupports(recipe('transitionProbability'), { kind: 'matrix-aggregate', reducer: 'max' } as Projection)).toBe(true)
    expect(recipeSupports(recipe('transitionCount'),       { kind: 'matrix-aggregate', reducer: 'max' } as Projection)).toBe(true)
  })
})

describe('windowing support gate', () => {
  it('rejects windowed projection on a recipe that opts out', () => {
    const r = recipe('timeToFirstFixation') // supportsWindowing: false
    const p: Projection = {
      kind: 'windowed',
      window: { windowSize: 2000, stepSize: 500 },
      inner: { kind: 'pick-aoi', aoiRef: { by: 'slot', slot: 0 } },
    }
    expect(recipeSupports(r, p)).not.toBe(true)
  })
  it('accepts windowed projection on absoluteTime', () => {
    const r = recipe('absoluteTime')
    const p: Projection = {
      kind: 'windowed',
      window: { windowSize: 2000, stepSize: 500 },
      inner: { kind: 'pick-aoi', aoiRef: { by: 'slot', slot: 0 } },
    }
    expect(recipeSupports(r, p)).toBe(true)
  })
  it('accepts windowed wrapper around an aoi-vector leaf (synthesizes aoi-vector-timeseries)', () => {
    const r = recipe('absoluteTime')
    const p: Projection = {
      kind: 'windowed',
      window: { windowSize: 1000, stepSize: 1000 },
      inner: { kind: 'identity-aoi-vector' },
    }
    expect(recipeSupports(r, p)).toBe(true)
  })
  it('rejects windowed wrapper around a matrix-shape leaf', () => {
    const r = recipe('transitionCount')
    const p: Projection = {
      kind: 'windowed',
      window: { windowSize: 1000, stepSize: 1000 },
      // identity-aoi-pair-matrix produces aoi-pair-matrix — not allowed under windowing
      inner: { kind: 'identity-aoi-pair-matrix' },
    }
    expect(recipeSupports(r, p)).not.toBe(true)
  })
  it('rejects windowed wrapper on TTFF even with aoi-vector inner', () => {
    const r = recipe('timeToFirstFixation') // supportsWindowing: false
    const p: Projection = {
      kind: 'windowed',
      window: { windowSize: 1000, stepSize: 1000 },
      inner: { kind: 'identity-aoi-vector' },
    }
    expect(recipeSupports(r, p)).not.toBe(true)
  })
  it('still rejects windowed × aggregate-aoi mean (across-AOI reducer rule applies)', () => {
    const r = recipe('absoluteTime')
    const p: Projection = {
      kind: 'windowed',
      window: { windowSize: 1000, stepSize: 1000 },
      inner: { kind: 'aggregate-aoi', reducer: 'mean' },
    }
    expect(recipeSupports(r, p)).not.toBe(true)
  })
})

describe('slot-ref guard', () => {
  it('rejects pick-aoi with slot < 0', () => {
    const r = recipe('absoluteTime')
    const p: Projection = { kind: 'pick-aoi', aoiRef: { by: 'slot', slot: -1 } }
    expect(recipeSupports(r, p)).not.toBe(true)
  })
  it('accepts positive slot-refs (bounds checked at apply time)', () => {
    const r = recipe('absoluteTime')
    const p: Projection = { kind: 'pick-aoi', aoiRef: { by: 'slot', slot: 0 } }
    expect(recipeSupports(r, p)).toBe(true)
  })
})

describe('raw-shape compatibility', () => {
  it('rejects pick-aoi on a scalar-raw recipe', () => {
    const r = recipe('rqaDet')
    const p: Projection = { kind: 'pick-aoi', aoiRef: { by: 'slot', slot: 0 } }
    expect(recipeSupports(r, p)).not.toBe(true)
  })
  it('accepts identity-scalar on a scalar-raw recipe', () => {
    const r = recipe('rqaDet')
    const p: Projection = { kind: 'identity-scalar' }
    expect(recipeSupports(r, p)).toBe(true)
  })
})

// ─── summary-statistic gate (declaration gates disclosure) ───────────────────

describe('summary statistic on a SUMMARY leaf', () => {
  /** Every leaf that may carry a `statistic`, with a valid concrete instance
   *  of each for the two aoi-vector recipes and the category-vector one. */
  const AOI_SUMMARY_LEAVES = [
    { kind: 'pick-aoi', aoiRef: { by: 'name', name: 'AOI 1' } },
    { kind: 'pick-any-fixation' },
  ] as const

  it('accepts a statistic on the aoi-axis sample-summarizing recipes', () => {
    for (const baseId of ['fixationDuration', 'visitDuration']) {
      for (const leaf of AOI_SUMMARY_LEAVES) {
        const p = { ...leaf, statistic: 'median' } as Projection
        expect(recipeSupports(recipe(baseId), p), `${baseId}/${leaf.kind}`).toBe(true)
      }
    }
  })

  it('accepts a statistic on the category-axis recipe (pick-category)', () => {
    const p: Projection = { kind: 'pick-category', categoryName: 'Saccade', statistic: 'max' }
    expect(recipeSupports(recipe('movementDuration'), p)).toBe(true)
  })

  it('rejects a statistic where the recipe declares no per-event sample', () => {
    // Counts and totals have nothing to summarize; a statistic there would
    // disclose a collapse that never happens. Same shape, same leaf — only
    // the recipe's `sampleSummary` declaration differs.
    for (const baseId of ['fixationCount', 'absoluteTime', 'visitCount']) {
      for (const leaf of AOI_SUMMARY_LEAVES) {
        const p = { ...leaf, statistic: 'median' } as Projection
        expect(recipeSupports(recipe(baseId), p), `${baseId}/${leaf.kind}`).not.toBe(true)
      }
    }
    const cat: Projection = { kind: 'pick-category', categoryName: 'Saccade', statistic: 'median' }
    expect(recipeSupports(recipe('movementCount'), cat)).not.toBe(true)
  })

  it('the same leaves stay valid WITHOUT a statistic on those recipes', () => {
    for (const leaf of AOI_SUMMARY_LEAVES) {
      expect(recipeSupports(recipe('fixationCount'), leaf as Projection), leaf.kind).toBe(true)
    }
  })
})

// ─── registry views are shared, not rebuilt ──────────────────────────────────

describe('getMetric returns one stable, frozen view per recipe', () => {
  it('is identity-stable across calls and across listMetrics', () => {
    // A recipe is immutable after registration, so its Metric view is built
    // once. Identity matters beyond the allocation: a `$derived` over a metric
    // must not re-run merely because the wrapper was rebuilt.
    const a = getMetric('absoluteTime')!
    expect(getMetric('absoluteTime')).toBe(a)
    expect(listMetrics().find(m => m.meta.id === 'absoluteTime')).toBe(a)
  })

  it('is frozen, because the value is now shared between callers', () => {
    const m = getMetric('fixationDuration')!
    expect(Object.isFrozen(m)).toBe(true)
    expect(Object.isFrozen(m.meta)).toBe(true)
  })
})
