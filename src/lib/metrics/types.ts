import type { MetricInstance } from '$lib/data/types'

export type MetricParamType = 'integer' | 'number' | 'enum' | 'boolean'

export interface MetricParamDef {
  id: string
  label: string
  type: MetricParamType
  default: number | string | boolean
  min?: number
  max?: number
  step?: number
  unit?: string
  options?: { value: string; label: string }[]
}

export type MetricCategory =
  | 'duration'
  | 'counts'
  | 'ttf'
  | 'rqa-aoi'
  | 'rqa-spatial'

export type MetricComputationMode = 'global' | 'epoch' | 'sliding'

export interface MetricData {
  dwellTime: number[]
  ttff: number[]
  fixationCount: number[]
  hitRatio: number[]
  entryCount: number[]
  dwellDurations: number[][]
  firstFixationDuration: number[]
  avgFixationDuration: number[][]
  fixationAoiSequence: number[]
  fixationTimestamps: number[]
}

export interface MetricDef {
  id: string
  label: string
  unit: string
  category: MetricCategory
  params?: MetricParamDef[]
  defaultLabel?: (params: Record<string, unknown>) => string
  computationModes?: MetricComputationMode[]
  searchTags?: string[]

  /** 'fixations' = RQA (window in fixation count); 'ms' = all others */
  windowUnit: 'ms' | 'fixations'

  /** Per-participant scalar. Returns NaN when undefined. */
  compute: (
    data: MetricData,
    aoiIndex: number,
    instance: MetricInstance
  ) => number

  /** Expands to N individual values per participant (for bar beeswarm). */
  extractIndividuals?: (
    data: MetricData,
    aoiIndex: number,
    instance: MetricInstance
  ) => number[]
}

export type { MetricInstance } from '$lib/data/types'
