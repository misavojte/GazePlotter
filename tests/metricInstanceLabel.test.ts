import { describe, it, expect } from 'vitest'
import {
  defaultInstanceLabel,
  formatParamReadout,
  getMetric,
  type MetricInstance,
} from '../src/lib/metrics'
import { buildMetricLabel } from '../src/lib/plots/shared/labels'
import {
  paramToLabel,
  enumParam,
  boolParam,
  integerParam,
  numberParam,
} from '../src/lib/metrics/core/params'

function inst(baseId: string, params: Record<string, unknown>): MetricInstance {
  return { id: 'i', baseId, params, label: '', projection: { kind: 'identity-aoi-pair-matrix' } }
}

// ─── paramToLabel: the single rule chips AND plot qualifiers compose from ─────

describe('paramToLabel (single readout rule)', () => {
  const mode = enumParam('mode', 'Count mode', 'fixation', [
    { value: 'fixation', label: 'Fixation pairs' },
    { value: 'visit', label: 'Visit changes' },
  ])

  it('enum → the selected option label (always)', () => {
    expect(paramToLabel(mode, 'fixation')).toBe('Fixation pairs')
    expect(paramToLabel(mode, 'visit')).toBe('Visit changes')
  })

  it('boolean → the param label when true, null when false; toLabel overrides phrasing', () => {
    expect(paramToLabel(boolParam('flag', 'My flag', false), true)).toBe('My flag')
    expect(paramToLabel(boolParam('flag', 'My flag', false), false)).toBeNull()
    const collapsed = boolParam('collapsed', 'Collapse consecutive AOIs', false, {
      toLabel: v => (v ? 'collapsed' : null),
    })
    expect(paramToLabel(collapsed, true)).toBe('collapsed')
    expect(paramToLabel(collapsed, false)).toBeNull()
  })

  it('numeric → "Label value [unit]" ALWAYS, including at the default', () => {
    const plain = integerParam('n', 'Min line', 2)
    expect(paramToLabel(plain, 2)).toBe('Min line 2') // default still shown (reproducible)
    expect(paramToLabel(plain, 4)).toBe('Min line 4')
    const withUnit = numberParam('minDwellMs', 'Min dwell', 0, { unit: 'ms' })
    expect(paramToLabel(withUnit, 0)).toBe('Min dwell 0 ms')
    expect(paramToLabel(withUnit, 100)).toBe('Min dwell 100 ms')
  })
})

// ─── defaultInstanceLabel: the BARE quantity name (no params/unit baked in) ───

describe('defaultInstanceLabel (bare quantity name)', () => {
  it('returns the recipe quantity name only — params live in the readout', () => {
    expect(defaultInstanceLabel('transitionCount')).toBe('Transitions')
    expect(defaultInstanceLabel('transitionProbability')).toBe('Transition probability')
    expect(defaultInstanceLabel('participantPairSimilarity')).toBe('Scanpath similarity')
  })
})

// ─── formatParamReadout: ONE full readout for selector AND plot ───────────────

describe('formatParamReadout (full — same in selector and on plots)', () => {
  it('reveals EVERY settable param incl. those at default (the fixated bug)', () => {
    expect(formatParamReadout(inst('fixated', { minFixationCount: 1, minDwellMs: 0 })))
      .toEqual(['Min fixations 1', 'Min dwell 0 ms'])
    expect(formatParamReadout(inst('fixated', { minFixationCount: 3, minDwellMs: 100 })))
      .toEqual(['Min fixations 3', 'Min dwell 100 ms'])
  })
  it('transition mode + step', () => {
    expect(formatParamReadout(inst('transitionProbability', { mode: 'fixation', step: 1 })))
      .toEqual(['Fixation pairs', 'Step 1'])
    expect(formatParamReadout(inst('transitionProbability', { mode: 'visit', step: 2 })))
      .toEqual(['Visit changes', 'Step 2'])
  })
  it('similarity method + collapsed (collapsed shown only when on, no parens)', () => {
    expect(formatParamReadout(inst('participantPairSimilarity', { method: 'levenshtein', collapsed: false })))
      .toEqual(['Levenshtein'])
    expect(formatParamReadout(inst('participantPairSimilarity', { method: 'needlemanWunsch', collapsed: true })))
      .toEqual(['Needleman-Wunsch', 'collapsed'])
  })
  it('appends an explicit groupAggregation override (one readout for selector AND figure)', () => {
    // A paramless metric still surfaces the override, so the selector chip set
    // and the plot axis can never disagree about a summed instance.
    const summed: MetricInstance = {
      id: 'i', baseId: 'absoluteTime', params: {}, label: '',
      projection: { kind: 'identity-aoi-vector' }, groupAggregation: 'sum',
    }
    expect(formatParamReadout(summed)).toEqual(['summed'])
    // The override trails the params, not replaces them.
    const summedTransitions: MetricInstance = {
      id: 'i', baseId: 'transitionProbability',
      params: { mode: 'visit', step: 2 }, label: '',
      projection: { kind: 'identity-aoi-pair-matrix' }, groupAggregation: 'sum',
    }
    expect(formatParamReadout(summedTransitions)).toEqual(['Visit changes', 'Step 2', 'summed'])
    // No override ⇒ no aggregation chip.
    expect(formatParamReadout(inst('absoluteTime', {}))).toEqual([])
  })
})

// ─── buildMetricLabel: the single entry point every plot calls ────────────────

describe('buildMetricLabel (unified plot/colorbar label)', () => {
  it('composes quantity / unit · param qualifiers', () => {
    expect(buildMetricLabel(inst('transitionProbability', { mode: 'visit', step: 2 }), getMetric('transitionProbability')))
      .toBe('Transition probability / % · Visit changes · Step 2')
  })
  it('unit:false drops the unit (correlation rows/cols carry differing units)', () => {
    expect(buildMetricLabel(inst('transitionProbability', { mode: 'visit', step: 2 }), getMetric('transitionProbability'), { unit: false }))
      .toBe('Transition probability · Visit changes · Step 2')
  })
  it('extra qualifiers append after, dropping falsy entries', () => {
    expect(buildMetricLabel(inst('transitionCount', { mode: 'fixation' }), getMetric('transitionCount'), {
      extra: [false, null, undefined, 'No-AOI excluded', 't ∈ [100, 5000] ms'],
    })).toBe('Transitions / count · Fixation pairs · No-AOI excluded · t ∈ [100, 5000] ms')
  })
  it('null instance → the fallback name, never blank', () => {
    expect(buildMetricLabel(null, undefined)).toBe('Value')
    expect(buildMetricLabel(null, undefined, { fallback: 'Similarity' })).toBe('Similarity')
    expect(buildMetricLabel(null, undefined, { unit: false, fallback: 'Transition value' })).toBe('Transition value')
  })

  it('discloses an explicit groupAggregation override as a qualifier (provenance)', () => {
    // A summed instance must read differently from a mean one on the figure, so
    // an AOI Timeline band labelled as a cohort total is self-documenting.
    const summed: MetricInstance = {
      id: 'i', baseId: 'absoluteTime', params: {}, label: '',
      projection: { kind: 'identity-aoi-vector' }, groupAggregation: 'sum',
    }
    expect(buildMetricLabel(summed, getMetric('absoluteTime')))
      .toBe('Absolute dwell time / ms · summed')

    // No override ⇒ the conventional statistic, no qualifier (no clutter).
    const plain: MetricInstance = { ...summed, groupAggregation: undefined }
    expect(buildMetricLabel(plain, getMetric('absoluteTime')))
      .toBe('Absolute dwell time / ms')
  })
})
