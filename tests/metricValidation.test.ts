/**
 * Tests for the central cooking-system validator. Covers each built-in rule
 * and each per-recipe `rejectedProjections` hook. Ensures invalid
 * combinations are rejected so the library modal hides them.
 */
import { describe, it, expect } from 'vitest'
import '../src/lib/metrics/init'
import { validateCombination } from '../src/lib/metrics/core/validation'
import { getRecipe } from '../src/lib/metrics/core/defineMetric'
import type { Projection } from '../src/lib/metrics/core/projection'

function recipe(id: string) {
  const r = getRecipe(id)
  if (!r) throw new Error(`Recipe "${id}" not found — check registration order.`)
  return r
}

describe('built-in rule: unit × aggregate-aoi sum', () => {
  it('rejects sum of percentages', () => {
    const r = recipe('relativeTime')
    const p: Projection = { target: 'scalar', from: 'aggregate-aoi', reducer: 'sum' }
    expect(validateCombination({ recipe: r, projection: p }).ok).toBe(false)
  })
  it('accepts mean of percentages', () => {
    const r = recipe('relativeTime')
    const p: Projection = { target: 'scalar', from: 'aggregate-aoi', reducer: 'mean' }
    expect(validateCombination({ recipe: r, projection: p }).ok).toBe(true)
  })
  it('accepts sum of ms (non-percentage)', () => {
    const r = recipe('absoluteTime')
    const p: Projection = { target: 'scalar', from: 'aggregate-aoi', reducer: 'sum' }
    expect(validateCombination({ recipe: r, projection: p }).ok).toBe(true)
  })
})

describe('built-in rule: matrix-aggregate mean on percent/probability matrix', () => {
  it('rejects matrix-aggregate mean on transitionProbability', () => {
    const r = recipe('transitionProbability')
    const p: Projection = { target: 'scalar', from: 'matrix-aggregate', reducer: 'mean' }
    expect(validateCombination({ recipe: r, projection: p }).ok).toBe(false)
  })
  it('rejects matrix-aggregate sum on transitionProbability', () => {
    const r = recipe('transitionProbability')
    const p: Projection = { target: 'scalar', from: 'matrix-aggregate', reducer: 'sum' }
    expect(validateCombination({ recipe: r, projection: p }).ok).toBe(false)
  })
  it('rejects matrix-aggregate on transitionRelativeFrequency', () => {
    const r = recipe('transitionRelativeFrequency')
    const p: Projection = { target: 'scalar', from: 'matrix-aggregate', reducer: 'mean' }
    expect(validateCombination({ recipe: r, projection: p }).ok).toBe(false)
  })
  it('accepts matrix-aggregate mean on transitionCount (unit=count)', () => {
    const r = recipe('transitionCount')
    const p: Projection = { target: 'scalar', from: 'matrix-aggregate', reducer: 'mean' }
    expect(validateCombination({ recipe: r, projection: p }).ok).toBe(true)
  })
  it('accepts matrix-cell on probability recipes (user goal: specific transition)', () => {
    const r = recipe('transitionProbability')
    const p: Projection = {
      target: 'scalar', from: 'matrix-cell',
      fromAoi: { by: 'name', name: 'A' },
      toAoi: { by: 'name', name: 'B' },
    }
    expect(validateCombination({ recipe: r, projection: p }).ok).toBe(true)
  })
})

describe('built-in rule: windowing mode must be supported', () => {
  it('rejects windowing on a global-only recipe', () => {
    const r = recipe('timeToFirstFixation') // computationModes defaults to ['global']
    const p: Projection = { target: 'aoi-vector', from: 'identity' }
    expect(validateCombination({
      recipe: r, projection: p,
      windowing: { mode: 'sliding', windowSize: 2000, reduction: 'mean' },
    }).ok).toBe(false)
  })
  it('accepts sliding windowing on absoluteTime', () => {
    const r = recipe('absoluteTime')
    const p: Projection = { target: 'aoi-vector', from: 'identity' }
    expect(validateCombination({
      recipe: r, projection: p,
      windowing: { mode: 'sliding', windowSize: 2000, reduction: 'mean' },
    }).ok).toBe(true)
  })
})

describe('per-recipe: timeToFirstFixation rejects mean/median/sum of first-times', () => {
  it('rejects aggregate-aoi mean', () => {
    const r = recipe('timeToFirstFixation')
    const p: Projection = { target: 'scalar', from: 'aggregate-aoi', reducer: 'mean' }
    expect(validateCombination({ recipe: r, projection: p }).ok).toBe(false)
  })
  it('rejects aggregate-aoi median', () => {
    const r = recipe('timeToFirstFixation')
    const p: Projection = { target: 'scalar', from: 'aggregate-aoi', reducer: 'median' }
    expect(validateCombination({ recipe: r, projection: p }).ok).toBe(false)
  })
  it('accepts aggregate-aoi min (= earliest AOI fixated)', () => {
    const r = recipe('timeToFirstFixation')
    const p: Projection = { target: 'scalar', from: 'aggregate-aoi', reducer: 'min' }
    expect(validateCombination({ recipe: r, projection: p }).ok).toBe(true)
  })
  it('accepts aggregate-aoi max (= latest AOI fixated)', () => {
    const r = recipe('timeToFirstFixation')
    const p: Projection = { target: 'scalar', from: 'aggregate-aoi', reducer: 'max' }
    expect(validateCombination({ recipe: r, projection: p }).ok).toBe(true)
  })
})

describe('built-in rule: negative slot-refs', () => {
  it('rejects pick-aoi with slot < 0', () => {
    const r = recipe('absoluteTime')
    const p: Projection = { target: 'scalar', from: 'pick-aoi', aoiRef: { by: 'slot', slot: -1 } }
    expect(validateCombination({ recipe: r, projection: p }).ok).toBe(false)
  })
  it('accepts positive slot-refs (bounds checked at apply time)', () => {
    const r = recipe('absoluteTime')
    const p: Projection = { target: 'scalar', from: 'pick-aoi', aoiRef: { by: 'slot', slot: 0 } }
    expect(validateCombination({ recipe: r, projection: p }).ok).toBe(true)
  })
})
