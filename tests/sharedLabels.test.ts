import { describe, it, expect } from 'vitest'
import {
  formatQuantity,
  formatMetricLabel,
  formatInstanceLabel,
  withQualifiers,
  rangeQualifier,
  timeRangeQualifier,
} from '../src/lib/plots/shared/labels'
import type { Metric, MetricInstance } from '../src/lib/metrics'

function buildMetric(label: string, unit: string): Metric {
  return {
    meta: {
      id: 'm',
      label,
      unit,
      description: '',
      category: 'duration',
      rawShape: 'aoi-vector',
      windowUnit: 'ms',
      params: [],
      searchTags: [],
      groupAggregation: 'mean',
      supportsGroupAggregation: true,
      supportsWindowing: true,
      additive: false,
      providesAnyFixation: false,
    },
  }
}

function buildInstance(label: string, baseId = 'm'): MetricInstance {
  return { id: 'i', baseId, params: {}, label, projection: { kind: 'identity-aoi-vector' } }
}

describe('formatQuantity (IUPAC)', () => {
  it('joins quantity and unit with " / "', () => {
    expect(formatQuantity('Absolute dwell time', 'ms')).toBe('Absolute dwell time / ms')
    expect(formatQuantity('Transition probability', '%')).toBe('Transition probability / %')
  })
  it('drops the unit when empty / nullish', () => {
    expect(formatQuantity('Order index', '')).toBe('Order index')
    expect(formatQuantity('Order index', null)).toBe('Order index')
    expect(formatQuantity('Order index')).toBe('Order index')
  })
  it('trims whitespace on both parts', () => {
    expect(formatQuantity('  Fixation count  ', ' count ')).toBe('Fixation count / count')
  })
})

describe('formatMetricLabel', () => {
  it('renders "<label> / <unit>" for ms / count / %', () => {
    expect(formatMetricLabel(buildMetric('Absolute dwell time', 'ms'))).toBe('Absolute dwell time / ms')
    expect(formatMetricLabel(buildMetric('Fixation count', 'count'))).toBe('Fixation count / count')
    expect(formatMetricLabel(buildMetric('Relative dwell time', '%'))).toBe('Relative dwell time / %')
  })
  it('drops the unit suffix when unit is empty', () => {
    expect(formatMetricLabel(buildMetric('Some metric', ''))).toBe('Some metric')
  })
  it('returns "Value" fallback for null/undefined metric', () => {
    expect(formatMetricLabel(null)).toBe('Value')
    expect(formatMetricLabel(undefined)).toBe('Value')
  })
})

describe('formatInstanceLabel', () => {
  it('uses the instance label (carries projection) + the metric unit', () => {
    expect(formatInstanceLabel(buildInstance('Time on AOI · 500 ms window'), buildMetric('Absolute dwell time', 'ms')))
      .toBe('Time on AOI · 500 ms window / ms')
  })
  it('prefers the instance label over the metric generic name', () => {
    expect(formatInstanceLabel(buildInstance('My renamed metric'), buildMetric('Fixation count', 'count')))
      .toBe('My renamed metric / count')
  })
  it('falls back to the metric generic name when no instance', () => {
    expect(formatInstanceLabel(null, buildMetric('Fixation count', 'count'))).toBe('Fixation count / count')
  })
  it('uses the explicit fallback when neither instance nor metric resolve', () => {
    expect(formatInstanceLabel(null, undefined, 'Similarity')).toBe('Similarity')
    expect(formatInstanceLabel(null, undefined)).toBe('Value')
  })
})

describe('withQualifiers (mid-dot grammar)', () => {
  it('returns the primary unchanged when no qualifiers', () => {
    expect(withQualifiers('Transition probability / %')).toBe('Transition probability / %')
  })
  it('appends one qualifier after a mid-dot', () => {
    expect(withQualifiers('Transition probability / %', 'No-AOI excluded'))
      .toBe('Transition probability / % · No-AOI excluded')
  })
  it('joins several qualifiers with mid-dots', () => {
    expect(withQualifiers('Fixation count / count', 'mean ± 95% CI', 't ∈ [100, 5000] ms'))
      .toBe('Fixation count / count · mean ± 95% CI · t ∈ [100, 5000] ms')
  })
  it('drops falsy and blank qualifiers (so callers can inline conditionals)', () => {
    expect(withQualifiers('Q', false, null, undefined, '', '   ', 'kept'))
      .toBe('Q · kept')
  })
})

describe('rangeQualifier (math-interval notation, no "/")', () => {
  it('renders a closed interval with a trailing plain unit', () => {
    expect(rangeQualifier('t', 100, 5000, 'ms')).toBe('t ∈ [100, 5000] ms')
  })
  it('renders half-open bounds', () => {
    expect(rangeQualifier('t', 100, 0, 'ms')).toBe('t ≥ 100 ms')
    expect(rangeQualifier('t', 0, 5000, 'ms')).toBe('t ≤ 5000 ms')
  })
  it('omits the unit when none given (e.g. order index)', () => {
    expect(rangeQualifier('i', 5, 20)).toBe('i ∈ [5, 20]')
    expect(rangeQualifier('i', 5, 0)).toBe('i ≥ 5')
  })
  it('returns null when no bound is set', () => {
    expect(rangeQualifier('t', 0, 0, 'ms')).toBeNull()
  })
})

describe('timeRangeQualifier', () => {
  it('renders a closed interval when both bounds are set', () => {
    expect(timeRangeQualifier(100, 5000)).toBe('t ∈ [100, 5000] ms')
  })
  it('renders a half-open bound when only one side is set', () => {
    expect(timeRangeQualifier(100, 0)).toBe('t ≥ 100 ms')
    expect(timeRangeQualifier(0, 5000)).toBe('t ≤ 5000 ms')
  })
  it('returns null when no range is set', () => {
    expect(timeRangeQualifier(0, 0)).toBeNull()
    expect(timeRangeQualifier()).toBeNull()
  })
})

describe('composed plot labels (the unified grammar)', () => {
  it('transition-matrix colorbar: quantity / unit · No-AOI excluded · time range', () => {
    const primary = formatQuantity('Transition probability', '%')
    expect(withQualifiers(primary, true && 'No-AOI excluded', timeRangeQualifier(100, 5000)))
      .toBe('Transition probability / % · No-AOI excluded · t ∈ [100, 5000] ms')
  })
  it('bar value axis: instance / unit · statistic (no time range when unbounded)', () => {
    const primary = formatInstanceLabel(buildInstance('Fixation count'), buildMetric('Fixation count', 'count'))
    expect(withQualifiers(primary, 'mean ± 95% CI', timeRangeQualifier(0, 0)))
      .toBe('Fixation count / count · mean ± 95% CI')
  })
  it('time-series x-axis: bare time quantity · window (the only "/" is the unit)', () => {
    // The window/step pair is comma-separated; "/" appears once, as the ms unit.
    expect(withQualifiers('Elapsed time / ms', '500 ms window, 100 ms step'))
      .toBe('Elapsed time / ms · 500 ms window, 100 ms step')
  })
  it('scarf ordinal x-axis: order-index range qualifier', () => {
    expect(withQualifiers('Order index', rangeQualifier('i', 5, 20)))
      .toBe('Order index · i ∈ [5, 20]')
  })
})
