/**
 * Unit tests for the projection layer — pure logic, no engine needed.
 * Covers leaf reshape, AOI resolution, missing-AOI semantics, cache keys and
 * labels for the wrapper variant.
 */
import { describe, it, expect } from 'vitest'
import {
  applyProjection,
  projectionOutputShape,
  projectionToLabel,
  projectionCacheKey,
  PROJECTION_LEAVES,
  identityFor,
  type Projection,
} from '../src/lib/metrics/core/projection'

const AOIS = ['Nav', 'CTA', 'Hero']

describe('projectionOutputShape', () => {
  it('reads leaf shape from registry', () => {
    expect(projectionOutputShape({ kind: 'identity-aoi-vector' })).toBe('aoi-vector')
    expect(projectionOutputShape({ kind: 'aggregate-aoi', reducer: 'mean' })).toBe('scalar')
    expect(projectionOutputShape({ kind: 'matrix-diagonal' })).toBe('aoi-vector')
  })
  it('windowed projection is always scalar-timeseries', () => {
    expect(projectionOutputShape({
      kind: 'windowed',
      window: { windowSize: 100, stepSize: 100 },
      inner: { kind: 'identity-scalar' },
    })).toBe('scalar-timeseries')
  })
})

describe('PROJECTION_LEAVES: rawShapes compatibility', () => {
  it('identity leaves map 1:1 to raw shapes', () => {
    expect(PROJECTION_LEAVES['identity-scalar'].rawShapes).toEqual(['scalar'])
    expect(PROJECTION_LEAVES['identity-aoi-vector'].rawShapes).toEqual(['aoi-vector'])
    expect(PROJECTION_LEAVES['identity-aoi-pair-matrix'].rawShapes).toEqual(['aoi-pair-matrix'])
  })
  it('aoi-vector reducers require aoi-vector raw', () => {
    expect(PROJECTION_LEAVES['pick-aoi'].rawShapes).toEqual(['aoi-vector'])
    expect(PROJECTION_LEAVES['aggregate-aoi'].rawShapes).toEqual(['aoi-vector'])
  })
  it('matrix projections require aoi-pair-matrix raw', () => {
    for (const k of ['matrix-diagonal', 'matrix-row', 'matrix-col', 'matrix-cell', 'matrix-aggregate'] as const) {
      expect(PROJECTION_LEAVES[k].rawShapes).toEqual(['aoi-pair-matrix'])
    }
  })
})

describe('identityFor', () => {
  it('maps raw shapes to matching identity leaves', () => {
    expect(identityFor('scalar')).toEqual({ kind: 'identity-scalar' })
    expect(identityFor('aoi-vector')).toEqual({ kind: 'identity-aoi-vector' })
    expect(identityFor('aoi-pair-matrix')).toEqual({ kind: 'identity-aoi-pair-matrix' })
  })
})

describe('applyProjection on aoi-vector', () => {
  const raw = [10, 20, 30, 5, 65] // [AOI0, AOI1, AOI2, noAoi, anyFix]

  it('pick-aoi by name', () => {
    const p: Projection = { kind: 'pick-aoi', aoiRef: { by: 'name', name: 'CTA' } }
    const out = applyProjection(p, { aoiNames: AOIS, rawValues: raw })
    expect(out.values).toEqual([20])
    expect(out.aoiMissing).toBe(false)
  })

  it('pick-aoi missing name → NaN + aoiMissing flag', () => {
    const p: Projection = { kind: 'pick-aoi', aoiRef: { by: 'name', name: 'Nope' } }
    const out = applyProjection(p, { aoiNames: AOIS, rawValues: raw })
    expect(Number.isNaN(out.values[0])).toBe(true)
    expect(out.aoiMissing).toBe(true)
  })

  it('aggregate-aoi mean ignores noAoi + anyFixation slots', () => {
    const p: Projection = { kind: 'aggregate-aoi', reducer: 'mean' }
    const out = applyProjection(p, { aoiNames: AOIS, rawValues: raw })
    expect(out.values).toEqual([20])
  })

  it('aggregate-aoi median', () => {
    const p: Projection = { kind: 'aggregate-aoi', reducer: 'median' }
    const out = applyProjection(p, { aoiNames: AOIS, rawValues: [1, 2, 100, 0, 103] })
    expect(out.values).toEqual([2])
  })
})

describe('applyProjection on aoi-pair-matrix', () => {
  // side = 4 (AOIs.length + 1 outside). Flat row-major 0..15
  const raw = Array.from({ length: 16 }, (_, i) => i)

  it('diagonal yields aoi-vector', () => {
    const p: Projection = { kind: 'matrix-diagonal' }
    const out = applyProjection(p, { aoiNames: AOIS, rawValues: raw })
    expect(out.values.slice(0, 3)).toEqual([0, 5, 10])
    expect(out.values[3]).toBe(15)
  })

  it('matrix-row by name', () => {
    const p: Projection = { kind: 'matrix-row', aoiRef: { by: 'name', name: 'CTA' } }
    const out = applyProjection(p, { aoiNames: AOIS, rawValues: raw })
    expect(out.values.slice(0, 3)).toEqual([4, 5, 6])
    expect(out.values[3]).toBe(7)
  })

  it('matrix-col by slot', () => {
    const p: Projection = { kind: 'matrix-col', aoiRef: { by: 'slot', slot: 2 } }
    const out = applyProjection(p, { aoiNames: AOIS, rawValues: raw })
    expect(out.values.slice(0, 3)).toEqual([2, 6, 10])
    expect(out.values[3]).toBe(14)
  })

  it('matrix-aggregate mean including diagonal', () => {
    const p: Projection = { kind: 'matrix-aggregate', reducer: 'mean' }
    const out = applyProjection(p, { aoiNames: AOIS, rawValues: raw })
    expect(out.values[0]).toBeCloseTo(7.5)
  })

  it('matrix-cell picks a single (from → to) cell', () => {
    const p: Projection = {
      kind: 'matrix-cell',
      fromAoi: { by: 'name', name: 'Nav' },
      toAoi:   { by: 'name', name: 'Hero' },
    }
    const out = applyProjection(p, { aoiNames: AOIS, rawValues: raw })
    // row=0 (Nav), col=2 (Hero), side=4 → raw[0*4 + 2] = 2
    expect(out.values).toEqual([2])
    expect(out.aoiMissing).toBe(false)
  })

  it('matrix-cell missing AOI → NaN + aoiMissing flag', () => {
    const p: Projection = {
      kind: 'matrix-cell',
      fromAoi: { by: 'name', name: 'Nav' },
      toAoi:   { by: 'name', name: 'Nope' },
    }
    const out = applyProjection(p, { aoiNames: AOIS, rawValues: raw })
    expect(Number.isNaN(out.values[0])).toBe(true)
    expect(out.aoiMissing).toBe(true)
  })

  it('matrix-aggregate sum excluding diagonal', () => {
    const p: Projection = { kind: 'matrix-aggregate', reducer: 'sum', exclude: 'diagonal' }
    const out = applyProjection(p, { aoiNames: AOIS, rawValues: raw })
    expect(out.values[0]).toBe(90) // 120 total − 30 diag
  })
})

describe('wrapper: applyProjection delegates to inner leaf', () => {
  it('windowed leaf applies inner to raw values', () => {
    const windowed: Projection = {
      kind: 'windowed',
      window: { windowSize: 100, stepSize: 100 },
      inner: { kind: 'aggregate-aoi', reducer: 'mean' },
    }
    const out = applyProjection(windowed, { aoiNames: AOIS, rawValues: [10, 20, 30, 5, 65] })
    expect(out.values).toEqual([20]) // mean of 10,20,30
  })
})

describe('projectionToLabel', () => {
  it('empty string for identity leaves', () => {
    expect(projectionToLabel({ kind: 'identity-scalar' })).toBe('')
  })
  it('aoi reducer for aggregate-aoi', () => {
    expect(projectionToLabel({ kind: 'aggregate-aoi', reducer: 'mean' }))
      .toMatch(/mean across AOIs/i)
  })
  it('windowed label appends window suffix', () => {
    const p: Projection = {
      kind: 'windowed',
      window: { windowSize: 100, stepSize: 100 },
      inner: { kind: 'identity-scalar' },
    }
    expect(projectionToLabel(p)).toMatch(/Window 100/)
  })
})

describe('projectionCacheKey', () => {
  it('stable key per projection kind + config', () => {
    const a = projectionCacheKey({ kind: 'pick-aoi', aoiRef: { by: 'slot', slot: 2 } })
    const b = projectionCacheKey({ kind: 'pick-aoi', aoiRef: { by: 'slot', slot: 2 } })
    expect(a).toBe(b)
  })
  it('differs when windowed', () => {
    const leaf: Projection = { kind: 'identity-scalar' }
    const wrapped: Projection = {
      kind: 'windowed', window: { windowSize: 100, stepSize: 100 }, inner: { kind: 'identity-scalar' },
    }
    expect(projectionCacheKey(leaf)).not.toBe(projectionCacheKey(wrapped))
  })
})
