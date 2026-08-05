import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { ParamDef, SummaryStatistic } from './params'
import type { Projection } from './projection'
import type { MeasurementClass, GroupReduction } from './measurement'

export type OutputShape =
  | 'scalar'
  | 'aoi-vector'
  | 'category-vector'
  | 'aoi-pair-matrix'
  | 'participant-pair-matrix'
  | 'scalar-timeseries'
  | 'aoi-vector-timeseries'
export type WindowUnit = 'ms' | 'fixations'
/** See {@link MetricRecipe.windowMembership}. */
export type WindowMembership = 'all' | 'own'

/** See {@link MetricRecipe.accumulation}. */
type WindowAccumulation =
  | 'clippedDuration'
  | 'clippedDurationShare'
  | 'midpointCount'
  | 'stateful'

/**
 * Evaluation context for recipes whose computation is inherently pairwise
 * across participants (scanpath similarity) — carries the SET of participants
 * the comparison ranges over, unlike the single-participant {@link Scope}.
 */
export interface GroupScope {
  engine: DataEngine
  stimulusId: number
  participantIds: readonly number[]
  timeStart?: number
  timeEnd?: number
  /** Copied into each per-participant child scope, so a grouped view honors the
   *  same reduced AOI alphabet as a single-participant one. */
  aoiSelectionId?: number
}

/**
 * Row-major M×M, `M === participantIds.length`. A recipe may filter or reorder
 * participants (e.g. drop empty scanpaths) — the returned `participantIds` is
 * the authoritative axis labelling.
 */
interface GroupResult {
  matrix: number[]
  participantIds: number[]
}

/**
 * The slot LAYOUT of a stimulus: `[aoi_0 … aoi_{n-1}, noAoi, anyFixation]`.
 * Pure numbers, safe to embed in results. The scan-side superset (reader +
 * rawId→slot table) is `ResolvedAoiSlots` in aoiSlots.ts.
 */
export interface AoiSlotInfo {
  totalSlots: number
  noAoiSlot: number
  anyFixationSlot: number
}

/**
 * A fixation projected onto the current scope's time range. Carried on every
 * {@link FixationEvent}, so a recipe declares its windowing semantics by which
 * field it reads rather than by a meta flag.
 *
 * Unbounded scopes (`timeStart === 0 && timeEnd === 0`): `windowStart` 0,
 * `windowEnd` +Infinity, `start`/`end`/`duration` mirror the fixation.
 *
 * CONTRIBUTION only. Whether a fixation is a MEMBER of the window is not a field
 * here — a gate is not something you read to compute a value — it is declared by
 * {@link MetricRecipe.windowMembership} and enforced once by the driver.
 */
export interface WindowFrame {
  /** Active scope's lower bound (inclusive). `0` for unbounded scopes. */
  windowStart: number
  /** Active scope's upper bound (exclusive). `+Infinity` for unbounded scopes. */
  windowEnd: number
  /** `max(fix.start, windowStart)`. */
  start: number
  /** `min(fix.end, windowEnd)`. */
  end: number
  /**
   * Sub-bin overlap: `end - start`. For additive dwell metrics, so a fixation
   * crossing a boundary contributes only its in-window portion and per-window
   * sums equal the unwindowed total. THE established "AOI occupancy"
   * semantics, matching the legacy aoi-stream collector; never drift.
   */
  duration: number
}

/**
 * Fills a {@link WindowFrame} for the two unwindowed scans; the windowed driver
 * inlines the same math to avoid a call per dispatch. Writes into
 * `out` and allocates nothing: scans reuse ONE frame across millions of
 * fixations, safe because `onFixation` reads synchronously and never retains it.
 */
export function fillWindowFrame(
  out: WindowFrame,
  start: number,
  end: number,
  timeStart: number,
  timeEnd: number,
): boolean {
  const bounded = timeEnd > 0
  const windowStart = bounded ? timeStart : 0
  const windowEnd = bounded ? timeEnd : Number.POSITIVE_INFINITY
  const frameStart = Math.max(start, windowStart)
  const frameEnd = bounded ? Math.min(end, windowEnd) : end
  out.windowStart = windowStart
  out.windowEnd = windowEnd
  out.start = frameStart
  out.end = frameEnd
  out.duration = frameEnd - frameStart
  // A bounded scope IS one window, so membership applies here too. This returns the
  // FACT (is the midpoint inside?); the POLICY is the recipe's `windowMembership`,
  // applied by the caller — one fact per fixation, N recipes may judge it differently.
  return bounded ? (start + end) / 2 >= windowStart && (start + end) / 2 < windowEnd : true
}

/**
 * A single fixation passed to a recipe's `onFixation`. The field read picks
 * the semantics: `fix.duration`/`fix.start` are the actual fixation's
 * properties, irrespective of the window (right for mean-of-actual-durations
 * and start-time metrics); `fix.frame.*` is its projection onto the window
 * (right for additive dwell and count metrics).
 */
export interface FixationEvent {
  start: number
  duration: number
  frame: WindowFrame
  slots: ReadonlyArray<number>
  index: number
  /**
   * The segment's eye-movement-type slot in `categoryGroups` order. Filled
   * ONLY for `scanSource: 'categories'` recipes; `-1` elsewhere, since the
   * fixation index carries no type dimension.
   */
  categorySlot: number
}

export interface InitCtx<P> {
  params: P
  slots: AoiSlotInfo
  /**
   * The scan's effective extent in ms — the denominator for
   * share-of-recording metrics, which a per-segment scan cannot see. Bounded
   * scope: `timeEnd - timeStart`. Unbounded: the participant's recording
   * length. Windowed: the window size (shared by every window of one run, so
   * the per-scan ctx stays shared). `0` with no segments → finalize to NaN.
   */
  scopeDurationMs: number
  /** Length of the eye-movement-type axis for `scanSource: 'categories'`
   *  recipes, whose finalize returns a vector of exactly this length. `0` on
   *  fixation-index scans. */
  categorySlotCount: number
  /**
   * How a {@link MetricRecipe.sampleSummary} recipe collapses each slot's
   * sample in `finalize`. Set by the instance's SUMMARY projection, and always
   * `'mean'` for vector outputs — a vector IS the unmarked per-slot mean.
   */
  summaryStatistic: SummaryStatistic
}

/**
 * What each extreme across AOIs MEANS for a metric ("most-dwelled AOI",
 * "first-reached AOI"). Lowercase noun phrases, to slot into the mid-dot
 * grammar: `"Absolute dwell time / ms · most-dwelled AOI"`. Declaration order
 * is presentation order — name the canonical extreme first (TTFF names `min`
 * before the caveat-laden `max`).
 */
export interface AoiAggregateLabels {
  readonly max?: string
  readonly min?: string
}

export interface MetricMeta {
  readonly id: string
  readonly label: string
  readonly unit: string
  /**
   * Leaf-neutral summary at the metric's natural shape, so it reads correctly
   * under every supported projection. Lead per shape: "Per AOI: …" /
   * "Per AOI pair (row → column): …" / "Stimulus-level: …", then how the value
   * is computed, then any interpretation and caveats (NaN behaviour, mode
   * rules).
   */
  readonly description: string
  readonly category: string
  /** Shape produced by the recipe's `finalize` call — before any projection. */
  readonly rawShape: OutputShape
  readonly windowUnit: WindowUnit
  readonly params: readonly ParamDef<any>[]
  readonly searchTags: readonly string[]
  /** The one declarative property the capability algebra
   *  (`core/measurement.ts`) reads to answer every aggregation question. */
  readonly measurementClass: MeasurementClass
  /** Headline reduction when an instance pins no override. Consulted only for
   *  `extensive` metrics (the only class offering both); `'mean'` otherwise. */
  readonly defaultReduction: GroupReduction
  /** Lets a recipe say "never windowed" (e.g. TTFF). Compatibility as such is
   *  gated by `recipeSupports` — the inner leaf must produce scalar. */
  readonly supportsWindowing: boolean
  /** True when the recipe writes a meaningful stimulus-level aggregate into
   *  the `anyFixationSlot` sentinel. Gates `pick-any-fixation`. */
  readonly providesAnyFixation: boolean
  /**
   * Opt-in to `aggregate-aoi` — reducing the per-AOI vector to ONE AOI's value
   * WITHIN each participant (the winning AOI may differ between them). The
   * declared phrase is at once the gate, the configure-UI option, and the
   * figure qualifier, so declaration and disclosure cannot drift.
   *
   * Only extremes exist here: max/min are order statistics, invariant to how
   * many AOIs the analyst drew, while sum/mean/median across AOIs are biased
   * by the segmentation (the stimulus-level total is `providesAnyFixation`).
   * Omit when no extreme reads clearly — notably on metrics with a settable
   * Summary `statistic`, where it would be a double reduction.
   */
  readonly aoiAggregate?: AoiAggregateLabels
  /** See {@link MetricRecipe.sampleSummary}. */
  readonly sampleSummary: boolean
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
  /**
   * WHICH windows a fixation belongs to. The driver enforces it once, so no
   * recipe writes a membership `if`.
   *
   *   - `'all'` (default) — every window the fixation overlaps. Right whenever the
   *     contribution is divisible (`frame.duration` clips it, so per-window sums
   *     still equal the total), and for any question of the form "did this happen
   *     in this interval" or "how big were the events around here".
   *   - `'own'` — only the window holding the fixation's midpoint. For sums of
   *     INDIVISIBLE events (a count), where it is what makes per-window values add
   *     up to the unwindowed total OVER NON-OVERLAPPING windows (a sliding window
   *     shares each event with its neighbours by design). Absence is still 0, never NaN: the window was
   *     evaluated, it just owns nothing.
   *
   * Required for `extensive` metrics — the class whose additivity depends on it —
   * so a new count cannot silently inherit the wrong rule. Never gate an
   * intensive MEAN on `'own'`: it reports NaN, i.e. a hole, for a window a
   * fixation plainly covers.
   */
  windowMembership?: WindowMembership
  params?: readonly ParamDef<any>[]
  searchTags?: readonly string[]
  /** See {@link MeasurementClass}. Required. */
  measurementClass: MeasurementClass
  /** Defaults to `'mean'`; set `'sum'` for `extensive` metrics whose
   *  conventional headline is the cohort total. Ignored for other classes. */
  defaultReduction?: GroupReduction
  /** Defaults to true. Set false when windowing is not meaningful (e.g. TTFF). */
  supportsWindowing?: boolean
  /**
   * What `onFixation` does with each fixation. Required for every scan-trio
   * recipe, forbidden for `scanGroup` ones (both enforced at registration).
   *
   * A CONTRACT, not a hint: on the additive kinds the windowed driver replaces
   * the trio with one fused numeric pass (no FixationEvent, no per-window
   * accumulators; ~an order of magnitude faster cold), and its output MUST be
   * bit-identical to running the trio per window. The windowed==oracle suite
   * pins that; the trio stays the definition, used verbatim when unwindowed.
   *
   * - `'clippedDuration'` — sums the fixation∩window overlap (ms) per slot
   *   (anyFixation always, noAoi when unlabeled, else each resolved slot).
   * - `'clippedDurationShare'` — same sums, finalized per window as a
   *   percentage of that window's anyFixation total (NaN when it is 0).
   * - `'midpointCount'` — adds 1 per slot in the window containing the
   *   fixation midpoint.
   * - `'stateful'` — anything else (visits, sequences, first-hit latencies):
   *   the accumulator carries cross-fixation state, so windowing runs the trio.
   */
  accumulation?: WindowAccumulation
  /**
   * Which segments the per-participant scan iterates.
   *
   * - `'fixationIndex'` (default) — the prebuilt category-0 index; the scan
   *   never reads segment categories.
   * - `'categories'` — EVERY segment, with `fix.categorySlot` set. The type is
   *   a DIMENSION the metric ranges over, never a parameter: one type is
   *   extracted downstream by the `pick-category` PROJECTION, as aoi-vector
   *   recipes pair with `pick-aoi`. Registration enforces `rawShape:
   *   'category-vector'` and `accumulation: 'stateful'` — the fused driver's
   *   per-AOI-slot assembly assumes fixation scans.
   */
  scanSource?: 'fixationIndex' | 'categories'
  /** Defaults to false. True opens `pick-any-fixation` for the metric. */
  providesAnyFixation?: boolean
  /** Opt in to `aggregate-aoi` by naming each extreme, e.g.
   *  `{ max: 'most-dwelled AOI' }` — see {@link MetricMeta.aoiAggregate}. */
  aoiAggregate?: AoiAggregateLabels
  /**
   * Declares that `finalize` collapses a per-slot sample by
   * {@link InitCtx.summaryStatistic} — the gate for a statistic-bearing
   * summary projection, as `aoiAggregate` gates `aggregate-aoi`. Registration
   * requires `individuals` (the sample must stay inspectable) and rejects a
   * `statistic` param: the summary choice has ONE declaration channel.
   */
  sampleSummary?: boolean
  /**
   * Author-level veto. Receives the full `Projection` — use
   * `p.kind === 'windowed' ? p.inner : p` when the check applies to the leaf
   * regardless of windowing. Return a non-null reason to reject.
   */
  rejects?: (projection: Projection) => string | null

  /** Per-participant scan trio. Required for every participant-local shape,
   *  absent for `participant-pair-matrix` (which uses {@link scanGroup}).
   *  Pairing enforced at registration. */
  init?(ctx: InitCtx<P>): A
  onFixation?(acc: A, fix: FixationEvent, ctx: InitCtx<P>): void
  /**
   * The per-participant vector. OMIT on a {@link sampleSummary} recipe, where
   * it is by definition `individuals` collapsed slot-by-slot with
   * `ctx.summaryStatistic` and `defineMetric` derives exactly that — spelling
   * it out per recipe is what let the sample metrics drift apart.
   */
  finalize?(acc: A, slots: AoiSlotInfo, ctx: InitCtx<P>): number[]
  /**
   * WHERE the per-event sample lives — one array per slot, allocated in
   * `init`. The beeswarm's raw dots: every fixation, visit or segment that
   * contributed. Whole array at once, so no caller needs a recipe's slot count.
   *
   * Omit when the per-participant value IS the single observation (a count, a
   * total, a 0/100 indicator): `queryPooledIndividuals` then contributes one
   * dot per participant from the cached aggregate — same number, no extra scan.
   */
  individuals?(acc: A): number[][]
  /**
   * Close state still open at scan end so `individuals` is complete
   * (visitDuration's in-progress visits). BOTH readers call it — the derived
   * `finalize` and `runIndividualsAllSlots` — so the summary and the dots can
   * never describe different events. Must be idempotent: clear what you flush.
   */
  flush?(acc: A, slots: AoiSlotInfo): void
  /** Fixation-windowed metrics (RQA) slice the accumulator per window. */
  windowedFinalize?(acc: A, fromIndex: number, toIndex: number, ctx: InitCtx<P>): number
  /** Required for `rawShape === 'participant-pair-matrix'`, forbidden
   *  otherwise. Returns a row-major M×M matrix plus its axis ordering. */
  scanGroup?(scope: GroupScope, params: P): GroupResult
}
