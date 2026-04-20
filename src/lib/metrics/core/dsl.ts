import type { ParamDef } from './params'

export type OutputShape = 'scalar' | 'aoi-vector' | 'aoi-pair-matrix'
export type WindowUnit = 'ms' | 'fixations'
export type ComputationMode = 'global' | 'epoch' | 'sliding'
export type Reduction = 'mean' | 'max' | 'min' | 'final'

export interface WindowingConfig {
  mode: 'epoch' | 'sliding'
  windowSize: number
  stepSize?: number
  reduction: Reduction
}

export interface AoiSlotInfo {
  totalSlots: number
  noAoiSlot: number
  anyFixationSlot: number
}

export interface FixationEvent {
  start: number
  duration: number
  slots: ReadonlyArray<number>
  index: number
}

export interface InitCtx<P> {
  params: P
  slots: AoiSlotInfo
}

export interface MetricMeta {
  readonly id: string
  readonly label: string
  readonly unit: string
  readonly description: string
  readonly category: string
  readonly outputShape: OutputShape
  readonly windowUnit: WindowUnit
  readonly params: readonly ParamDef<any>[]
  readonly searchTags: readonly string[]
  readonly computationModes: readonly ComputationMode[]
  readonly groupAggregation: 'mean' | 'median' | 'sum'
  readonly defaultWindowing?: WindowingConfig
  readonly defaultParamSets: readonly Record<string, unknown>[]
  readonly defaultLabel?: (p: Record<string, unknown>) => string
}

/** The registered, public view of a metric. */
export interface Metric {
  readonly meta: MetricMeta
}

export interface MetricRecipe<P, A> {
  id: string
  label: string
  unit: string
  description: string
  category: string
  outputShape: OutputShape
  windowUnit: WindowUnit
  params?: readonly ParamDef<any>[]
  searchTags?: readonly string[]
  computationModes?: ComputationMode[]
  groupAggregation?: 'mean' | 'median' | 'sum'
  defaultWindowing?: WindowingConfig
  /**
   * Parameter sets to seed as pre-curated system instances in the project
   * library. Primarily for aoi-pair-matrix metrics (which createSystemMetricInstances
   * filters out), but any metric can use it to expose starter variants with
   * different params.
   */
  defaultParamSets?: ReadonlyArray<Record<string, unknown>>
  defaultLabel?: (params: P) => string
  /**
   * Authorial veto over specific projection/windowing combinations. Returns
   * a non-null reason to reject; the central validator runs this AFTER the
   * built-in cross-cutting rules. Use for domain knowledge the rules can't
   * know — e.g., TTFF + aggregate-aoi mean is defensible only under `min`.
   */
  rejectedProjections?: (
    p: import('./projection').Projection,
    w?: WindowingConfig
  ) => string | null

  init(ctx: InitCtx<P>): A
  onFixation(acc: A, fix: FixationEvent, ctx: InitCtx<P>): void
  finalize(acc: A, slots: AoiSlotInfo, ctx: InitCtx<P>): number[]
  individuals?(acc: A, slotIndex: number): number[]

  /**
   * Optional hook for fixation-windowed metrics (RQA). Given the full accumulator
   * (which typically holds a fixation sequence) and a `[from, to)` index range,
   * returns the scalar result for just that sub-range. If omitted, fixation windowing
   * falls back to calling `finalize` over a re-scoped accumulator, which most metrics
   * do not support.
   */
  windowedFinalize?(
    acc: A,
    fromIndex: number,
    toIndex: number,
    ctx: InitCtx<P>
  ): number
}
