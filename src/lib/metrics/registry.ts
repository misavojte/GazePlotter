import type { MetricDef, MetricData } from './types'
import type { MetricInstance } from '$lib/data/types'
import { computeRqaAoiScalar } from './rqaAoiCompute'

function mean(arr: number[]): number {
  if (arr.length === 0) return Number.NaN
  let sum = 0
  for (let i = 0; i < arr.length; i++) sum += arr[i]
  return sum / arr.length
}

export const METRIC_DEFS: readonly MetricDef[] = [
  {
    id: 'absoluteTime',
    label: 'Absolute dwell time',
    unit: 'ms',
    category: 'duration',
    windowUnit: 'ms',
    computationModes: ['global', 'epoch', 'sliding'],
    searchTags: ['dwell', 'gaze', 'time', 'absolute', 'total', 'duration', 'aoi'],
    compute: (d: MetricData, i: number) => d.dwellTime[i],
  },
  {
    id: 'relativeTime',
    label: 'Relative dwell time',
    unit: '%',
    category: 'duration',
    windowUnit: 'ms',
    computationModes: ['global', 'epoch', 'sliding'],
    searchTags: ['dwell', 'gaze', 'time', 'relative', 'percent', 'proportion', 'duration', 'aoi'],
    compute: (d: MetricData, i: number) => {
      let total = 0
      for (let k = 0; k < d.dwellTime.length; k++) total += d.dwellTime[k]
      return total > 0 ? (d.dwellTime[i] / total) * 100 : 0
    },
  },
  {
    id: 'averageEntries',
    label: 'Visit count',
    unit: 'count',
    category: 'counts',
    windowUnit: 'ms',
    computationModes: ['global', 'epoch', 'sliding'],
    searchTags: ['visit', 'entry', 'entries', 'count', 'aoi', 'number', 'transitions'],
    compute: (d: MetricData, i: number) => d.entryCount[i],
  },
  {
    id: 'avgDwellDuration',
    label: 'Visit duration',
    unit: 'ms',
    category: 'duration',
    windowUnit: 'ms',
    computationModes: ['global', 'epoch', 'sliding'],
    searchTags: ['visit', 'dwell', 'duration', 'average', 'mean', 'aoi'],
    compute: (d: MetricData, i: number) => mean(d.dwellDurations[i] ?? []),
    extractIndividuals: (d: MetricData, i: number) => d.dwellDurations[i] ?? [],
  },
  {
    id: 'averageFixationCount',
    label: 'Fixation count',
    unit: 'count',
    category: 'counts',
    windowUnit: 'ms',
    computationModes: ['global', 'epoch', 'sliding'],
    searchTags: ['fixation', 'count', 'number', 'fix', 'aoi'],
    compute: (d: MetricData, i: number) => d.fixationCount[i],
  },
  {
    id: 'avgFixationDuration',
    label: 'Fixation duration',
    unit: 'ms',
    category: 'duration',
    windowUnit: 'ms',
    computationModes: ['global', 'epoch', 'sliding'],
    searchTags: ['fixation', 'duration', 'average', 'mean', 'fix', 'aoi'],
    compute: (d: MetricData, i: number) => mean(d.avgFixationDuration[i] ?? []),
    extractIndividuals: (d: MetricData, i: number) => d.avgFixationDuration[i] ?? [],
  },
  {
    id: 'timeToFirstFixation',
    label: 'Time to first fixation',
    unit: 'ms',
    category: 'ttf',
    windowUnit: 'ms',
    searchTags: ['ttff', 'ttf', 'first', 'fixation', 'time', 'latency', 'onset', 'aoi'],
    compute: (d: MetricData, i: number) => d.ttff[i] === -1 ? Number.NaN : d.ttff[i],
  },
  {
    id: 'avgFirstFixationDuration',
    label: 'First fixation duration',
    unit: 'ms',
    category: 'ttf',
    windowUnit: 'ms',
    searchTags: ['first', 'fixation', 'duration', 'ttf', 'aoi'],
    compute: (d: MetricData, i: number) =>
      d.firstFixationDuration[i] === -1 ? Number.NaN : d.firstFixationDuration[i],
  },
  {
    id: 'rqaRec',
    label: 'Recurrence rate',
    unit: '%',
    category: 'rqa-aoi',
    windowUnit: 'fixations',
    computationModes: ['global', 'epoch', 'sliding'],
    searchTags: ['rqa', 'recurrence', 'rec', 'nonlinear', 'aoi', 'sequence', 'cross'],
    compute: (d: MetricData, _i: number, instance: MetricInstance) =>
      computeRqaAoiScalar(instance, d),
  },
  {
    id: 'rqaDet',
    label: 'Determinism',
    unit: '%',
    category: 'rqa-aoi',
    windowUnit: 'fixations',
    computationModes: ['global', 'epoch', 'sliding'],
    params: [
      { id: 'l_min', label: 'Min line', type: 'integer', default: 2, min: 2, max: 20 },
    ],
    searchTags: ['rqa', 'determinism', 'det', 'diagonal', 'nonlinear', 'aoi', 'sequence'],
    compute: (d: MetricData, _i: number, instance: MetricInstance) =>
      computeRqaAoiScalar(instance, d),
  },
  {
    id: 'rqaLam',
    label: 'Laminarity',
    unit: '%',
    category: 'rqa-aoi',
    windowUnit: 'fixations',
    computationModes: ['global', 'epoch', 'sliding'],
    params: [
      { id: 'v_min', label: 'Min line', type: 'integer', default: 2, min: 2, max: 20 },
    ],
    searchTags: ['rqa', 'laminarity', 'lam', 'vertical', 'nonlinear', 'aoi', 'sequence'],
    compute: (d: MetricData, _i: number, instance: MetricInstance) =>
      computeRqaAoiScalar(instance, d),
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
