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

export interface MetricDef {
  id: string
  label: string
  unit: string
  category: MetricCategory
  params?: MetricParamDef[]
  defaultLabel?: (params: Record<string, unknown>) => string
  computationModes?: MetricComputationMode[]
}

export type { MetricInstance } from '$lib/data/types'
