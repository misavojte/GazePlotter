import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'

export type MetricParamType = 'integer' | 'number' | 'enum' | 'boolean'

export type MetricOutputShape = 'scalar' | 'aoi-vector' | 'aoi-pair-matrix'

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

/** @deprecated Use open string category instead — kept for backwards compat */
export type MetricCategory =
  | 'duration'
  | 'counts'
  | 'ttf'
  | 'rqa-aoi'
  | 'rqa-spatial'

export type MetricComputationMode = 'global' | 'epoch' | 'sliding'

export interface WindowingConfig {
  mode: 'epoch' | 'sliding'
  windowSize: number
  stepSize?: number
  reduction: 'mean' | 'max' | 'min' | 'final'
}

export interface MetricInstance {
  id: number
  baseId: string
  params: Record<string, unknown>
  label: string
  system?: true
  windowing?: WindowingConfig
}

export interface MetricComputeContext {
  stimulusId: number
  participantId: number
  timeStart: number
  timeEnd: number
}

export interface SegmentScanner {
  push(fixStart: number, fixDuration: number, slots: ReadonlyArray<number>): void
  finalize(): number[]
  extractIndividuals?(aoiIndex: number): number[]
}

export interface MetricDef {
  readonly id: string
  readonly label: string
  readonly unit: string
  readonly category: string
  readonly description: string
  readonly outputShape: MetricOutputShape
  readonly params?: MetricParamDef[]
  readonly defaultLabel?: (params: Record<string, unknown>) => string
  readonly computationModes?: MetricComputationMode[]
  readonly searchTags?: string[]
  readonly windowUnit: 'ms' | 'fixations'
  readonly requires?: { segmented?: boolean; spatial?: boolean; event?: boolean }

  groupAggregation?: 'mean' | 'median' | 'sum'

  compute(engine: DataEngine, ctx: MetricComputeContext, instance: MetricInstance): number[]
  extractIndividuals?(engine: DataEngine, ctx: MetricComputeContext, aoiIndex: number, instance: MetricInstance): number[]
  createScanner?(totalSlots: number, noAoiSlot: number, anyFixationSlot: number, instance: MetricInstance): SegmentScanner
}
