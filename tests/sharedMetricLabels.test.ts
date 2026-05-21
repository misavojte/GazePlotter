import { describe, it, expect } from 'vitest'
import { formatMetricLabel } from '../src/lib/plots/shared/metricLabels'
import type { Metric } from '../src/lib/metrics'

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

describe('formatMetricLabel', () => {
  it('renders "<label> / <unit>" (IUPAC convention) for a duration metric', () => {
    expect(formatMetricLabel(buildMetric('Absolute dwell time', 'ms')))
      .toBe('Absolute dwell time / ms')
  })

  it('renders "<label> / count" for a count metric', () => {
    expect(formatMetricLabel(buildMetric('Fixation count', 'count')))
      .toBe('Fixation count / count')
  })

  it('renders "<label> / %" for a percentage metric', () => {
    expect(formatMetricLabel(buildMetric('Relative dwell time', '%')))
      .toBe('Relative dwell time / %')
  })

  it('drops the unit suffix when unit is empty', () => {
    expect(formatMetricLabel(buildMetric('Some metric', '')))
      .toBe('Some metric')
  })

  it('returns "Value" fallback for null/undefined metric', () => {
    expect(formatMetricLabel(null)).toBe('Value')
    expect(formatMetricLabel(undefined)).toBe('Value')
  })
})
