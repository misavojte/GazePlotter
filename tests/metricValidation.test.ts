/**
 * Tests for the central validation function `recipeSupports`. Covers each
 * built-in scientific guard plus per-recipe `rejects` hooks. Ensures invalid
 * combinations are rejected so the library modal hides them.
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

describe('scientific guard: aggregate-aoi sum on percent recipe', () => {
  it('rejects sum of percentages', () => {
    const r = recipe('relativeTime')
    const p: Projection = { kind: 'aggregate-aoi', reducer: 'sum' }
    expect(recipeSupports(r, p)).not.toBe(true)
  })
  it('accepts mean of percentages', () => {
    const r = recipe('relativeTime')
    const p: Projection = { kind: 'aggregate-aoi', reducer: 'mean' }
    expect(recipeSupports(r, p)).toBe(true)
  })
  it('accepts sum of ms (non-percentage)', () => {
    const r = recipe('absoluteTime')
    const p: Projection = { kind: 'aggregate-aoi', reducer: 'sum' }
    expect(recipeSupports(r, p)).toBe(true)
  })
})

describe('scientific guard: matrix-aggregate on percent/probability matrix', () => {
  it('rejects matrix-aggregate mean on transitionProbability', () => {
    const r = recipe('transitionProbability')
    const p: Projection = { kind: 'matrix-aggregate', reducer: 'mean' }
    expect(recipeSupports(r, p)).not.toBe(true)
  })
  it('rejects matrix-aggregate sum on transitionProbability', () => {
    const r = recipe('transitionProbability')
    const p: Projection = { kind: 'matrix-aggregate', reducer: 'sum' }
    expect(recipeSupports(r, p)).not.toBe(true)
  })
  it('rejects matrix-aggregate on transitionRelativeFrequency', () => {
    const r = recipe('transitionRelativeFrequency')
    const p: Projection = { kind: 'matrix-aggregate', reducer: 'mean' }
    expect(recipeSupports(r, p)).not.toBe(true)
  })
  it('accepts matrix-aggregate mean on transitionCount (unit=count)', () => {
    const r = recipe('transitionCount')
    const p: Projection = { kind: 'matrix-aggregate', reducer: 'mean' }
    expect(recipeSupports(r, p)).toBe(true)
  })
  it('accepts matrix-cell on probability recipes (user goal: specific transition)', () => {
    const r = recipe('transitionProbability')
    const p: Projection = {
      kind: 'matrix-cell',
      fromAoi: { by: 'name', name: 'A' },
      toAoi:   { by: 'name', name: 'B' },
    }
    expect(recipeSupports(r, p)).toBe(true)
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
  it('rejects windowed wrapper around a non-scalar leaf', () => {
    const r = recipe('absoluteTime')
    const p: Projection = {
      kind: 'windowed',
      window: { windowSize: 1000, stepSize: 1000 },
      // identity-aoi-vector produces aoi-vector, not scalar — invalid
      inner: { kind: 'identity-aoi-vector' } as any,
    }
    expect(recipeSupports(r, p)).not.toBe(true)
  })
})

describe('per-recipe rejects: timeToFirstFixation excludes mean/median/sum aggregates', () => {
  it('rejects aggregate-aoi mean', () => {
    const r = recipe('timeToFirstFixation')
    const p: Projection = { kind: 'aggregate-aoi', reducer: 'mean' }
    expect(recipeSupports(r, p)).not.toBe(true)
  })
  it('rejects aggregate-aoi median', () => {
    const r = recipe('timeToFirstFixation')
    const p: Projection = { kind: 'aggregate-aoi', reducer: 'median' }
    expect(recipeSupports(r, p)).not.toBe(true)
  })
  it('accepts aggregate-aoi min (= earliest AOI fixated)', () => {
    const r = recipe('timeToFirstFixation')
    const p: Projection = { kind: 'aggregate-aoi', reducer: 'min' }
    expect(recipeSupports(r, p)).toBe(true)
  })
  it('accepts aggregate-aoi max (= latest AOI fixated)', () => {
    const r = recipe('timeToFirstFixation')
    const p: Projection = { kind: 'aggregate-aoi', reducer: 'max' }
    expect(recipeSupports(r, p)).toBe(true)
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
