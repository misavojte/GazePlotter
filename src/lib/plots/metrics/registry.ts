import type { MetricDef } from './types'

/**
 * Participant-scalar metric registry. Authoritative.
 *
 * These 8 are the seed system metrics. Parametric families (RQA etc.) will be
 * added here as additional MetricDef entries with populated `params` arrays.
 */
export const METRIC_DEFS: readonly MetricDef[] = [
  {
    id: 'absoluteTime',
    label: 'Absolute dwell time',
    unit: 'ms',
    category: 'duration',
    computationModes: ['global', 'epoch'],
  },
  {
    id: 'relativeTime',
    label: 'Relative dwell time',
    unit: '%',
    category: 'duration',
    computationModes: ['global', 'epoch'],
  },
  {
    id: 'averageEntries',
    label: 'Visit count',
    unit: 'count',
    category: 'counts',
    computationModes: ['global', 'epoch'],
  },
  {
    id: 'avgDwellDuration',
    label: 'Visit duration',
    unit: 'ms',
    category: 'duration',
    computationModes: ['global', 'epoch'],
  },
  {
    id: 'averageFixationCount',
    label: 'Fixation count',
    unit: 'count',
    category: 'counts',
    computationModes: ['global', 'epoch'],
  },
  {
    id: 'avgFixationDuration',
    label: 'Fixation duration',
    unit: 'ms',
    category: 'duration',
    computationModes: ['global', 'epoch'],
  },
  {
    id: 'timeToFirstFixation',
    label: 'Time to first fixation',
    unit: 'ms',
    category: 'ttf',
  },
  {
    id: 'avgFirstFixationDuration',
    label: 'First fixation duration',
    unit: 'ms',
    category: 'ttf',
  },
  {
    id: 'rqaRec',
    label: 'Recurrence rate',
    unit: '%',
    category: 'rqa-aoi',
    computationModes: ['global', 'epoch', 'sliding'],
  },
  {
    id: 'rqaDet',
    label: 'Determinism',
    unit: '%',
    category: 'rqa-aoi',
    computationModes: ['global', 'epoch', 'sliding'],
    params: [
      { id: 'l_min', label: 'Min line', type: 'integer', default: 2, min: 2, max: 20 },
    ],
  },
  {
    id: 'rqaLam',
    label: 'Laminarity',
    unit: '%',
    category: 'rqa-aoi',
    computationModes: ['global', 'epoch', 'sliding'],
    params: [
      { id: 'v_min', label: 'Min line', type: 'integer', default: 2, min: 2, max: 20 },
    ],
  },
]

export function getMetricDef(baseId: string): MetricDef | undefined {
  return METRIC_DEFS.find(d => d.id === baseId)
}

export const METRIC_CATEGORY_ORDER: readonly string[] = [
  'duration',
  'counts',
  'ttf',
  'rqa-aoi',
  'rqa-spatial',
]

export const METRIC_CATEGORY_LABELS: Record<string, string> = {
  duration: 'Duration',
  counts: 'Counts',
  ttf: 'Time to first fixation',
  'rqa-aoi': 'RQA (AOI-based)',
  'rqa-spatial': 'RQA (spatial)',
}
