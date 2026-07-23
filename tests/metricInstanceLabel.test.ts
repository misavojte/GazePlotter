import { describe, it, expect } from 'vitest'
import {
  defaultInstanceLabel,
  formatParamReadout,
  instanceReadout,
  reductionQualifier,
  resolveReduction,
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
  it('stays purely params — the reduction is composed separately', () => {
    // formatParamReadout never carries the reduction; that keeps it composable.
    const summed: MetricInstance = {
      id: 'i', baseId: 'absoluteTime', params: {}, label: '',
      projection: { kind: 'identity-aoi-vector' }, reduction: 'sum',
    }
    expect(formatParamReadout(summed)).toEqual([])
  })
})

// ─── reductionQualifier / resolveReduction ────────────────────────────────────
// The sound set is a PURE function of the metric's measurementClass — projection
// independent, no guards (see soundReductions in measurement.test.ts).

describe('reductionQualifier (discloses only a cohort sum)', () => {
  const vec = { kind: 'identity-aoi-vector' as const }
  it('mean (the conventional default) needs no chip; sum reads "summed"', () => {
    const base = { id: 'i', params: {}, label: '', projection: vec }
    // intensive default mean → no chip.
    expect(reductionQualifier({ ...base, baseId: 'relativeTime' })).toBeNull()
    // extensive default mean → no chip; an explicit sum → "summed".
    expect(reductionQualifier({ ...base, baseId: 'absoluteTime' })).toBeNull()
    expect(reductionQualifier({ ...base, baseId: 'absoluteTime', reduction: 'sum' })).toBe('summed')
    // transitionCount defaults to sum → "summed" even with no override.
    expect(reductionQualifier({ id: 'i', params: {}, label: '', baseId: 'transitionCount', projection: { kind: 'identity-aoi-pair-matrix' } })).toBe('summed')
  })
  it('is null where there is no reduction to disclose (proportion, relational)', () => {
    const base = { id: 'i', params: { minFixationCount: 1, minDwellMs: 0 }, label: '', projection: vec }
    expect(reductionQualifier({ ...base, baseId: 'fixated' })).toBeNull()
  })
})

describe('resolveReduction (request === result; unsound clamps to default)', () => {
  it('honours a sound override verbatim; clamps an unsound one to the default', () => {
    const vec = { kind: 'identity-aoi-vector' as const }
    // extensive: sum is sound on ANY projection (no shape downgrade).
    expect(resolveReduction({ id: 'i', baseId: 'absoluteTime', params: {}, label: '', projection: vec, reduction: 'sum' })).toBe('sum')
    expect(resolveReduction({ id: 'i', baseId: 'absoluteTime', params: {}, label: '', projection: vec })).toBe('mean')
    // intensive: sum is unsound → clamps to the metric default (mean).
    expect(resolveReduction({ id: 'i', baseId: 'relativeTime', params: {}, label: '', projection: vec, reduction: 'sum' })).toBe('mean')
    // transitionCount default reduction is sum.
    expect(resolveReduction({ id: 'i', baseId: 'transitionCount', params: {}, label: '', projection: { kind: 'identity-aoi-pair-matrix' } })).toBe('sum')
  })
})

describe('instanceReadout (params + reduction — the one selector/figure source)', () => {
  it('combines params and the reduction chip (mean suppressed)', () => {
    const inst1: MetricInstance = {
      id: 'i', baseId: 'transitionProbability', params: { mode: 'visit', step: 2 },
      label: '', projection: { kind: 'identity-aoi-pair-matrix' },
    }
    expect(instanceReadout(inst1)).toEqual(['Visit changes', 'Step 2'])
  })
  it('includeReduction:false drops the chip (bar plot discloses via overlay)', () => {
    const inst1: MetricInstance = {
      id: 'i', baseId: 'absoluteTime', params: {}, label: '',
      projection: { kind: 'identity-aoi-vector' }, reduction: 'sum',
    }
    expect(instanceReadout(inst1)).toEqual(['summed'])
    expect(instanceReadout(inst1, { includeReduction: false })).toEqual([])
  })
})

// ─── within-fixation summary statistic (mean/median/…) disclosure ─────────────

describe('summary statistic disclosure', () => {
  it('is disclosed via instanceReadout (mean shown too), NOT as a generic param chip', () => {
    // Skipped in the generic param readout so a plot can toggle it like the
    // reduction chip…
    expect(formatParamReadout(inst('fixationDuration', {}))).toEqual([])
    expect(formatParamReadout(inst('fixationDuration', { statistic: 'median' }))).toEqual([])
    // …and disclosed via instanceReadout — unlike the reduction, `mean` shows too.
    expect(instanceReadout(inst('fixationDuration', {}))).toEqual(['mean'])
    expect(instanceReadout(inst('fixationDuration', { statistic: 'median' }))).toEqual(['median'])
    expect(instanceReadout(inst('visitDuration', { statistic: 'max' }))).toEqual(['max'])
  })
  it('metrics without a statistic param emit no summary chip', () => {
    expect(instanceReadout(inst('absoluteTime', {}))).toEqual([])
    expect(instanceReadout(inst('fixationCount', {}))).toEqual([])
  })
  it('includeSummaryStat:false drops it (bar plot discloses via its overlay)', () => {
    expect(
      instanceReadout(inst('fixationDuration', { statistic: 'median' }), {
        includeSummaryStat: false,
      })
    ).toEqual([])
  })
  it('buildMetricLabel puts the statistic on the colorbar; the bar opts out', () => {
    expect(buildMetricLabel(inst('fixationDuration', {}), getMetric('fixationDuration')))
      .toBe('Fixation duration / ms · mean')
    expect(
      buildMetricLabel(inst('fixationDuration', { statistic: 'median' }), getMetric('fixationDuration'))
    ).toBe('Fixation duration / ms · median')
    expect(
      buildMetricLabel(inst('fixationDuration', { statistic: 'median' }), getMetric('fixationDuration'), {
        includeSummaryStat: false,
      })
    ).toBe('Fixation duration / ms')
  })
})

// ─── buildMetricLabel: the single entry point every plot calls ────────────────

describe('buildMetricLabel (unified plot/colorbar label)', () => {
  it('composes quantity / unit · param qualifiers (mean reduction needs no chip)', () => {
    expect(buildMetricLabel(inst('transitionProbability', { mode: 'visit', step: 2 }), getMetric('transitionProbability')))
      .toBe('Transition probability / % · Visit changes · Step 2')
  })
  it('unit:false drops the unit (correlation rows/cols carry differing units)', () => {
    expect(buildMetricLabel(inst('transitionProbability', { mode: 'visit', step: 2 }), getMetric('transitionProbability'), { unit: false }))
      .toBe('Transition probability · Visit changes · Step 2')
  })
  it('extra qualifiers append after the reduction, dropping falsy entries', () => {
    // transitionCount defaults to sum → "summed" chip is present.
    expect(buildMetricLabel(inst('transitionCount', { mode: 'fixation' }), getMetric('transitionCount'), {
      extra: [false, null, undefined, 'No-AOI excluded', 't ∈ [100, 5000] ms'],
    })).toBe('Transitions / count · Fixation pairs · summed · No-AOI excluded · t ∈ [100, 5000] ms')
  })
  it('includeReduction:false suppresses the chip (bar plot opt-out)', () => {
    expect(buildMetricLabel(inst('transitionCount', { mode: 'fixation' }), getMetric('transitionCount'), { includeReduction: false }))
      .toBe('Transitions / count · Fixation pairs')
  })
  it('null instance → the fallback name, never blank', () => {
    expect(buildMetricLabel(null, undefined)).toBe('Value')
    expect(buildMetricLabel(null, undefined, { fallback: 'Similarity' })).toBe('Similarity')
    expect(buildMetricLabel(null, undefined, { unit: false, fallback: 'Transition value' })).toBe('Transition value')
  })

  it('discloses only a cohort sum — summed override vs the bare default mean', () => {
    // A summed instance reads `· summed`; the default-mean instance is bare (mean
    // is the conventional default and needs no disclosure).
    const summed: MetricInstance = {
      id: 'i', baseId: 'absoluteTime', params: {}, label: '',
      projection: { kind: 'identity-aoi-vector' }, reduction: 'sum',
    }
    expect(buildMetricLabel(summed, getMetric('absoluteTime')))
      .toBe('Absolute dwell time / ms · summed')

    const plain: MetricInstance = { ...summed, reduction: undefined }
    expect(buildMetricLabel(plain, getMetric('absoluteTime')))
      .toBe('Absolute dwell time / ms')
  })

  it('aggregate-aoi prints the metric-named meaning of the extreme, not the operator', () => {
    // The phrase the recipe declared in `aoiAggregate` is the disclosed
    // qualifier — the same words that gated the projection in the configure UI.
    const peak: MetricInstance = {
      id: 'i', baseId: 'absoluteTime', params: {}, label: '',
      projection: { kind: 'aggregate-aoi', reducer: 'max' },
    }
    expect(buildMetricLabel(peak, getMetric('absoluteTime'), { includeProjection: true }))
      .toBe('Absolute dwell time / ms · most-dwelled AOI')

    const firstHit: MetricInstance = {
      id: 'i', baseId: 'timeToFirstFixation', params: {}, label: '',
      projection: { kind: 'aggregate-aoi', reducer: 'min' },
    }
    expect(buildMetricLabel(firstHit, getMetric('timeToFirstFixation'), { includeProjection: true }))
      .toBe('Time to first fixation / ms · first-reached AOI')
  })
})
