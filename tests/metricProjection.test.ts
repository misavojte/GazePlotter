/**
 * Unit tests for the projection layer — pure logic, no engine needed.
 * Covers shape transforms, AOI resolution, missing-AOI semantics, and the
 * scientific-rigor unit guard (sum-of-percentages rejected).
 */
import { describe, it, expect } from 'vitest'
import {
  applyProjection,
  computeEffectiveShape,
  isProjectionValid,
  targetsFor,
  fromMethodsFor,
  type Projection,
} from '../src/lib/metrics/core/projection'
import { validateProjectionForUnit } from '../src/lib/metrics/core/validation'

const AOIS = ['Nav', 'CTA', 'Hero']

describe('computeEffectiveShape = projection.target', () => {
  it('returns the projection target directly', () => {
    expect(computeEffectiveShape('aoi-vector', { target: 'aoi-vector', from: 'identity' })).toBe('aoi-vector')
    expect(computeEffectiveShape('aoi-vector', { target: 'scalar', from: 'aggregate-aoi', reducer: 'mean' })).toBe('scalar')
    expect(computeEffectiveShape('aoi-pair-matrix', { target: 'aoi-vector', from: 'matrix-diagonal' })).toBe('aoi-vector')
  })
})

describe('targetsFor / fromMethodsFor / isProjectionValid', () => {
  it('enumerates legal targets per raw shape', () => {
    expect(targetsFor('scalar')).toEqual(['scalar'])
    expect(targetsFor('aoi-vector').sort()).toEqual(['aoi-vector', 'scalar'].sort())
    expect(targetsFor('aoi-pair-matrix').sort()).toEqual(['aoi-pair-matrix', 'aoi-vector', 'scalar'].sort())
  })
  it('enumerates methods per (raw, target)', () => {
    expect(fromMethodsFor('aoi-vector', 'scalar')).toEqual(['pick-aoi', 'aggregate-aoi'])
    expect(fromMethodsFor('aoi-pair-matrix', 'aoi-vector')).toEqual(['matrix-diagonal', 'matrix-row', 'matrix-col'])
    expect(fromMethodsFor('aoi-pair-matrix', 'scalar')).toEqual(['matrix-cell', 'matrix-aggregate'])
    expect(fromMethodsFor('scalar', 'scalar')).toEqual(['identity'])
  })
  it('rejects cross-shape projections', () => {
    expect(isProjectionValid('aoi-vector', { target: 'aoi-vector', from: 'matrix-diagonal' } as any)).toBe(false)
    expect(isProjectionValid('aoi-pair-matrix', { target: 'scalar', from: 'pick-aoi', aoiRef: { by: 'slot', slot: 0 } } as any)).toBe(false)
  })
})

describe('applyProjection on aoi-vector', () => {
  const raw = [10, 20, 30, 5, 65] // [AOI0, AOI1, AOI2, noAoi, anyFix]

  it('pick-aoi by name', () => {
    const p: Projection = { target: 'scalar', from: 'pick-aoi', aoiRef: { by: 'name', name: 'CTA' } }
    const out = applyProjection(raw, 'aoi-vector', p, { aoiNames: AOIS })
    expect(out.values).toEqual([20])
    expect(out.aoiMissing).toBe(false)
  })

  it('pick-aoi missing name → NaN + aoiMissing flag', () => {
    const p: Projection = { target: 'scalar', from: 'pick-aoi', aoiRef: { by: 'name', name: 'Nope' } }
    const out = applyProjection(raw, 'aoi-vector', p, { aoiNames: AOIS })
    expect(Number.isNaN(out.values[0])).toBe(true)
    expect(out.aoiMissing).toBe(true)
  })

  it('aggregate-aoi mean ignores noAoi + anyFixation slots', () => {
    const p: Projection = { target: 'scalar', from: 'aggregate-aoi', reducer: 'mean' }
    const out = applyProjection(raw, 'aoi-vector', p, { aoiNames: AOIS })
    expect(out.values).toEqual([20])
  })

  it('aggregate-aoi median', () => {
    const p: Projection = { target: 'scalar', from: 'aggregate-aoi', reducer: 'median' }
    const out = applyProjection([1, 2, 100, 0, 103], 'aoi-vector', p, { aoiNames: AOIS })
    expect(out.values).toEqual([2])
  })
})

describe('applyProjection on aoi-pair-matrix', () => {
  // side = 4 (AOIs.length + 1 outside). Flat row-major 0..15
  const raw = Array.from({ length: 16 }, (_, i) => i)

  it('diagonal yields aoi-vector', () => {
    const p: Projection = { target: 'aoi-vector', from: 'matrix-diagonal' }
    const out = applyProjection(raw, 'aoi-pair-matrix', p, { aoiNames: AOIS })
    expect(out.values.slice(0, 3)).toEqual([0, 5, 10])
    expect(out.values[3]).toBe(15)
  })

  it('matrix-row by name', () => {
    const p: Projection = { target: 'aoi-vector', from: 'matrix-row', aoiRef: { by: 'name', name: 'CTA' } }
    const out = applyProjection(raw, 'aoi-pair-matrix', p, { aoiNames: AOIS })
    expect(out.values.slice(0, 3)).toEqual([4, 5, 6])
    expect(out.values[3]).toBe(7)
  })

  it('matrix-col by slot', () => {
    const p: Projection = { target: 'aoi-vector', from: 'matrix-col', aoiRef: { by: 'slot', slot: 2 } }
    const out = applyProjection(raw, 'aoi-pair-matrix', p, { aoiNames: AOIS })
    expect(out.values.slice(0, 3)).toEqual([2, 6, 10])
    expect(out.values[3]).toBe(14)
  })

  it('matrix-aggregate mean including diagonal', () => {
    const p: Projection = { target: 'scalar', from: 'matrix-aggregate', reducer: 'mean' }
    const out = applyProjection(raw, 'aoi-pair-matrix', p, { aoiNames: AOIS })
    expect(out.values[0]).toBeCloseTo(7.5)
  })

  it('matrix-cell picks a single (from → to) cell', () => {
    const p: Projection = {
      target: 'scalar', from: 'matrix-cell',
      fromAoi: { by: 'name', name: 'Nav' },
      toAoi: { by: 'name', name: 'Hero' },
    }
    const out = applyProjection(raw, 'aoi-pair-matrix', p, { aoiNames: AOIS })
    // row=0 (Nav), col=2 (Hero), side=4 → raw[0*4 + 2] = 2
    expect(out.values).toEqual([2])
    expect(out.aoiMissing).toBe(false)
  })

  it('matrix-cell missing AOI → NaN + aoiMissing flag', () => {
    const p: Projection = {
      target: 'scalar', from: 'matrix-cell',
      fromAoi: { by: 'name', name: 'Nav' },
      toAoi: { by: 'name', name: 'Nope' },
    }
    const out = applyProjection(raw, 'aoi-pair-matrix', p, { aoiNames: AOIS })
    expect(Number.isNaN(out.values[0])).toBe(true)
    expect(out.aoiMissing).toBe(true)
  })

  it('matrix-aggregate sum excluding diagonal', () => {
    const p: Projection = { target: 'scalar', from: 'matrix-aggregate', reducer: 'sum', exclude: 'diagonal' }
    const out = applyProjection(raw, 'aoi-pair-matrix', p, { aoiNames: AOIS })
    expect(out.values[0]).toBe(90) // 120 total − 30 diag
  })
})

describe('validateProjectionForUnit', () => {
  it('rejects sum of percentages', () => {
    const p: Projection = { target: 'scalar', from: 'aggregate-aoi', reducer: 'sum' }
    expect(validateProjectionForUnit(p, '%')).not.toBe(true)
  })
  it('accepts mean of percentages', () => {
    const p: Projection = { target: 'scalar', from: 'aggregate-aoi', reducer: 'mean' }
    expect(validateProjectionForUnit(p, '%')).toBe(true)
  })
  it('rejects matrix-sum of percentages', () => {
    const p: Projection = { target: 'scalar', from: 'matrix-aggregate', reducer: 'sum' }
    expect(validateProjectionForUnit(p, '%')).not.toBe(true)
  })
  it('allows sum for non-percent units', () => {
    const p: Projection = { target: 'scalar', from: 'aggregate-aoi', reducer: 'sum' }
    expect(validateProjectionForUnit(p, 'ms')).toBe(true)
  })
})
