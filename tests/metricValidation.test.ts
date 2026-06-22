/**
 * Tests for the central validation function `recipeSupports`. The rules are:
 *
 *   - `aggregate-aoi` (across an aoi-vector): only `max` and `min` — blanket rule.
 *   - `matrix-aggregate` (across cells): `max | min` by default;
 *     `extensive`-class recipes get the full `sum | mean | max | min`.
 *   - Windowing gated by `supportsWindowing`.
 *   - Slot refs must be non-negative.
 *   - Raw-shape compatibility is enforced via the leaf registry.
 */
import { describe, it, expect } from 'vitest'
import '../src/lib/metrics/init'
import { recipeSupports } from '../src/lib/metrics/core/validation'
import { getRecipe } from '../src/lib/metrics/core/defineMetric'
import type { Projection } from '../src/lib/metrics/core/projection'

function recipe(id: string) {
  const r = getRecipe(id)
  if (!r) throw new Error(`Recipe "${id}" not found — check registration order.`)
  return r
}

describe('aggregate-aoi: blanket max/min rule across every aoi-vector recipe', () => {
  it.each(['absoluteTime', 'relativeTime', 'fixationCount', 'timeToFirstFixation'])(
    '%s rejects mean across AOIs',
    (id) => {
      const p: Projection = { kind: 'aggregate-aoi', reducer: 'mean' }
      expect(recipeSupports(recipe(id), p)).not.toBe(true)
    },
  )
  it.each(['absoluteTime', 'relativeTime', 'fixationCount', 'timeToFirstFixation'])(
    '%s rejects sum across AOIs',
    (id) => {
      const p: Projection = { kind: 'aggregate-aoi', reducer: 'sum' }
      expect(recipeSupports(recipe(id), p)).not.toBe(true)
    },
  )
  it.each(['absoluteTime', 'relativeTime', 'fixationCount', 'timeToFirstFixation'])(
    '%s rejects median across AOIs',
    (id) => {
      const p: Projection = { kind: 'aggregate-aoi', reducer: 'median' }
      expect(recipeSupports(recipe(id), p)).not.toBe(true)
    },
  )
  it.each(['absoluteTime', 'relativeTime', 'fixationCount', 'timeToFirstFixation'])(
    '%s accepts min across AOIs',
    (id) => {
      const p: Projection = { kind: 'aggregate-aoi', reducer: 'min' }
      expect(recipeSupports(recipe(id), p)).toBe(true)
    },
  )
  it.each(['absoluteTime', 'relativeTime', 'fixationCount', 'timeToFirstFixation'])(
    '%s accepts max across AOIs',
    (id) => {
      const p: Projection = { kind: 'aggregate-aoi', reducer: 'max' }
      expect(recipeSupports(recipe(id), p)).toBe(true)
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
