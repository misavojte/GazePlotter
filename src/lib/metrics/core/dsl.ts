import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import type { ParamDef } from './params'
import type { Projection } from './projection'

export type OutputShape =
  | 'scalar'
  | 'aoi-vector'
  | 'aoi-pair-matrix'
  | 'participant-pair-matrix'
  | 'scalar-timeseries'
export type WindowUnit = 'ms' | 'fixations'

/**
 * Group-level evaluation context for recipes whose computation is inherently
 * pairwise across participants (e.g. scanpath similarity). A `GroupScope` carries
 * the *set* of participants the comparison ranges over, in contrast to the
 * single-participant {@link Scope} used by per-participant scans.
 */
export interface GroupScope {
  engine: DataEngine
  stimulusId: number
  participantIds: readonly number[]
  timeStart?: number
  timeEnd?: number
}

/**
 * Result shape returned by {@link MetricRecipe.scanGroup}. The matrix is
 * row-major M×M where `M === participantIds.length`. Recipes are free to
 * filter or reorder participants from the input scope (e.g. drop participants
 * with empty scanpaths) — the returned `participantIds` is the authoritative
 * axis labelling for the matrix.
 */
export interface GroupResult {
  matrix: number[]
  participantIds: number[]
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
  /**
   * Leaf-neutral one-paragraph summary, written at the metric's natural shape
   * (`rawShape`). Convention:
   *   - aoi-vector       → lead with "Per AOI: …"
   *   - aoi-pair-matrix  → lead with "Per AOI pair (row → column): …"
   *   - scalar           → lead with "Stimulus-level: …"
   * Then state how the value is computed at that shape, optionally followed
   * by one sentence of scientific interpretation and any caveats (NaN
   * behaviour, mode-dependent rules). Must read correctly under every
   * supported projection — never assume a specific leaf.
   */
  readonly description: string
  readonly category: string
  /** Shape produced by the recipe's `finalize` call — before any projection. */
  readonly rawShape: OutputShape
  readonly windowUnit: WindowUnit
  readonly params: readonly ParamDef<any>[]
  readonly searchTags: readonly string[]
  readonly groupAggregation: 'mean' | 'median' | 'sum'
  /**
   * Whether `queryGroup` reduces this metric across participants via per-slot
   * aggregation. Defaults to true. Set to false for shapes whose computation
   * is intrinsically group-level (e.g. participant-pair-matrix), where the
   * recipe owns the full group entry point via {@link MetricRecipe.scanGroup}
   * and per-slot reduction would collapse the very axis the shape is built on.
   */
  readonly supportsGroupAggregation: boolean
  /**
   * True unless the recipe explicitly opts out. Windowing compatibility is
   * ultimately gated by `recipeSupports(recipe, projection)` — the effective
   * inner leaf must produce scalar. This flag only lets a recipe say
   * "never windowed" (e.g. time-to-first-fixation).
   */
  readonly supportsWindowing: boolean
  /**
   * Opt-in marker for metrics whose underlying quantity is truly additive
   * across matrix cells (counts, summed durations). Unlocks `sum` / `mean`
   * for `matrix-aggregate`. Default `false` restricts matrix-aggregate to
   * `max | min`, matching the majority scientific reading (averages, rates,
   * probabilities). Has no effect on `aggregate-aoi` (always `max | min`).
   */
  readonly additive: boolean
  /**
   * True when the recipe writes a meaningful stimulus-level aggregate into
   * the `anyFixationSlot` sentinel (index `aoiCount + 1` of an aoi-vector).
   * Required for the `pick-any-fixation` projection to be allowed.
   */
  readonly providesAnyFixation: boolean
  readonly defaultLabel?: (p: Record<string, unknown>) => string
}

export interface Metric { readonly meta: MetricMeta }

export interface MetricRecipe<P, A> {
  id: string
  label: string
  unit: string
  description: string
  category: string
  rawShape: OutputShape
  windowUnit: WindowUnit
  params?: readonly ParamDef<any>[]
  searchTags?: readonly string[]
  groupAggregation?: 'mean' | 'median' | 'sum'
  /** Defaults to true. Set to false when windowing is not meaningful (e.g. TTFF). */
  supportsWindowing?: boolean
  /**
   * Defaults to false. Opt in for count / summed-duration metrics where sum /
   * mean across matrix cells is scientifically defensible; unlocks the full
   * `matrix-aggregate` reducer set. Non-additive recipes (averages, rates,
   * first-occurrences) get the restricted `max | min` reducer set.
   */
  additive?: boolean
  /**
   * Defaults to false. Set to true when the recipe writes a meaningful
   * stimulus-level aggregate into `anyFixationSlot`; opens the
   * `pick-any-fixation` projection for the metric.
   */
  providesAnyFixation?: boolean
  /**
   * Defaults to true. Set to false for recipes whose `rawShape` is inherently
   * group-level (e.g. participant-pair-matrix). When false, `queryGroup`
   * short-circuits to {@link MetricRecipe.scanGroup} and skips per-slot
   * reduction across participants.
   */
  supportsGroupAggregation?: boolean
  /**
   * Author-level veto over specific projections. Receives the full `Projection`
   * — use `p.kind === 'windowed' ? p.inner : p` when the check applies to the
   * leaf regardless of windowing. Return a non-null reason to reject.
   */
  rejects?: (projection: Projection) => string | null
  defaultLabel?: (params: P) => string

  /**
   * Per-participant scan trio. Required for recipes whose `rawShape` is one of
   * the participant-local shapes (`scalar`, `aoi-vector`, `aoi-pair-matrix`,
   * `scalar-timeseries`). Absent for `participant-pair-matrix` recipes, which
   * compute via {@link scanGroup} instead. The pairing invariant is enforced
   * at registration time in `defineMetric`.
   */
  init?(ctx: InitCtx<P>): A
  onFixation?(acc: A, fix: FixationEvent, ctx: InitCtx<P>): void
  finalize?(acc: A, slots: AoiSlotInfo, ctx: InitCtx<P>): number[]
  individuals?(acc: A, slotIndex: number): number[]
  /** Fixation-windowed metrics (RQA) slice the accumulator per window. */
  windowedFinalize?(acc: A, fromIndex: number, toIndex: number, ctx: InitCtx<P>): number
  /**
   * Group-level entry point. Required for recipes with
   * `rawShape === 'participant-pair-matrix'` and forbidden otherwise. Receives
   * the full {@link GroupScope} and returns a flat row-major M×M matrix
   * together with the participant ordering for its axes.
   */
  scanGroup?(scope: GroupScope, params: P): GroupResult
}
