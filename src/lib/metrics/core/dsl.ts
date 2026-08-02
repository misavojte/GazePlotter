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

/** See {@link MetricRecipe.accumulation}. */
type WindowAccumulation =
  | 'clippedDuration'
  | 'clippedDurationShare'
  | 'midpointCount'
  | 'stateful'

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
  /**
   * Per-plot AOI SELECTION id — mirrors {@link Scope.aoiSelectionId}. The group
   * runtime copies it into each per-participant child scope so a grouped view
   * honors the same reduced AOI alphabet as a single-participant one.
   */
  aoiSelectionId?: number
}

/**
 * Result shape returned by {@link MetricRecipe.scanGroup}. The matrix is
 * row-major M×M where `M === participantIds.length`. Recipes are free to
 * filter or reorder participants from the input scope (e.g. drop participants
 * with empty scanpaths) — the returned `participantIds` is the authoritative
 * axis labelling for the matrix.
 */
interface GroupResult {
  matrix: number[]
  participantIds: number[]
}

/**
 * The slot LAYOUT of a stimulus: `[aoi_0 … aoi_{n-1}, noAoi, anyFixation]`.
 * Pure numbers — safe to embed in results and recipe contexts. The scan-side
 * superset (reader + rawId→slot table) is `ResolvedAoiSlots` in aoiSlots.ts;
 * use that only inside scan loops.
 */
export interface AoiSlotInfo {
  totalSlots: number
  noAoiSlot: number
  anyFixationSlot: number
}

/**
 * Window-aware projection of a fixation onto the current scope's time
 * range. Carried on every {@link FixationEvent} so recipes choose their
 * windowing semantics by the field they read — the *code itself* declares
 * intent, no meta flag, no parallel field.
 *
 * Two scientific signals live here:
 *
 *   - `duration` is **fractional sub-bin overlap**:
 *     `min(fix.end, windowEnd) - max(fix.start, windowStart)`. Matches the
 *     legacy aoi-stream collector's per-bin overlap math exactly. Use this
 *     for additive dwell metrics (e.g. `absoluteTime`, `relativeTime`) so
 *     a fixation crossing window boundaries contributes only its in-window
 *     portion and per-window sums equal the unwindowed total.
 *
 *   - `midpointInWindow` is the **SW-RQA membership rule**: a fixation
 *     "belongs to" exactly one window — the one whose interval contains
 *     the fixation's midpoint. Use this to gate count-style metrics (e.g.
 *     `fixationCount`, `visitCount`) so each fixation contributes to one
 *     window only and per-window counts sum to the unwindowed total. For
 *     unbounded scopes this is always `true`.
 *
 * For unbounded scopes (`timeStart === 0 && timeEnd === 0`), `windowStart`
 * is `0`, `windowEnd` is `+Infinity`, `start`/`end`/`duration` mirror the
 * fixation's own interval, `isClipped` is `false`, and `midpointInWindow`
 * is `true`.
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
   * Sub-bin overlap duration: `end - start`. Matches the legacy
   * aoi-stream collector's per-bin overlap math exactly. THE established
   * semantics for the "AOI occupancy" view; never drift.
   */
  duration: number
  /** `true` when the original fixation extends beyond either bound. */
  isClipped: boolean
  /**
   * SW-RQA convention: this fixation's midpoint falls within the window.
   * Use to gate count-style contributions so each fixation belongs to
   * exactly one window. `true` for unbounded scopes.
   */
  midpointInWindow: boolean
}

/**
 * Single canonical construction of a {@link WindowFrame} from a fixation's
 * raw `(start, end, duration)` and the active scope's `(timeStart, timeEnd)`
 * — every scan (`scanAccumulator`, `scanBatch`) fills through here, keeping
 * SW-RQA midpoint semantics, occupancy duration math, and the clipped-flag
 * rule in one place. Writes into `out` and returns it, allocating nothing:
 * scans reuse ONE frame object across millions of fixations, safe because
 * `onFixation` reads frame fields synchronously and never retains the object
 * (the same invariant that lets a scan reuse one `slots` array). Unbounded
 * scopes (`timeEnd <= 0`) get `windowStart=0`, `windowEnd=+Infinity`, frame
 * mirrors fixation, and `midpointInWindow=true`.
 */
export function fillWindowFrame(
  out: WindowFrame,
  start: number,
  end: number,
  duration: number,
  timeStart: number,
  timeEnd: number,
): WindowFrame {
  const bounded = timeEnd > 0
  const windowStart = bounded ? timeStart : 0
  const windowEnd = bounded ? timeEnd : Number.POSITIVE_INFINITY
  const frameStart = Math.max(start, windowStart)
  const frameEnd = bounded ? Math.min(end, windowEnd) : end
  const mid = start + duration / 2
  out.windowStart = windowStart
  out.windowEnd = windowEnd
  out.start = frameStart
  out.end = frameEnd
  out.duration = frameEnd - frameStart
  out.isClipped = bounded && (start < windowStart || end > windowEnd)
  out.midpointInWindow = bounded ? mid >= windowStart && mid < windowEnd : true
  return out
}

/**
 * A single fixation passed to a recipe's `onFixation`. Recipes choose
 * window-aware vs window-naive semantics by the field they read:
 *
 *   - `fix.duration` / `fix.start` — the actual fixation's properties,
 *     irrespective of the active window. Right for mean-of-actual-durations
 *     metrics (`fixationDuration`, `firstFixationDuration`) and start-time
 *     queries (`timeToFirstFixation`).
 *
 *   - `fix.frame.duration` / `fix.frame.start` / `fix.frame.midpointInWindow`
 *     — the fixation's projection onto the current scope window. Right for
 *     additive dwell metrics (`absoluteTime`, `relativeTime`) and count
 *     metrics (`fixationCount`, `visitCount`).
 *
 * The choice is statically inspectable: any `onFixation` body that reads
 * `fix.frame.*` declares a windowable recipe; bodies that only read
 * `fix.duration` / `fix.start` / `fix.slots` declare a window-naive one.
 */
export interface FixationEvent {
  start: number
  duration: number
  frame: WindowFrame
  slots: ReadonlyArray<number>
  index: number
  /**
   * The segment's eye-movement-type slot, in the canonical displayed-name
   * group order (`categoryGroups` — Fixation first by the id-0 reservation).
   * Filled ONLY for `scanSource: 'categories'` recipes, whose accumulators
   * index per-type vectors by it; `-1` on every other scan (the fixation
   * index carries no type dimension).
   */
  categorySlot: number
}

export interface InitCtx<P> {
  params: P
  slots: AoiSlotInfo
  /**
   * The scan's effective time extent in ms — the denominator for
   * share-of-recording metrics, which the per-segment scan cannot otherwise
   * see. Bounded scopes: `timeEnd - timeStart`. Unbounded: the participant's
   * recording length (last segment end). Time-windowed runs: the window size
   * (every window of one run shares it, so the per-scan ctx stays shared).
   * `0` when the participant has no segments — finalize to NaN, not a share
   * of nothing.
   */
  scopeDurationMs: number
  /**
   * Length of the eye-movement-type axis for `scanSource: 'categories'`
   * recipes (`categoryGroups(engine).length` — one slot per displayed-name
   * group, canonical order, Fixation first). Their `finalize` returns a
   * vector of exactly this length. `0` on fixation-index scans.
   */
  categorySlotCount: number
  /**
   * How a sample-summarizing recipe ({@link MetricRecipe.sampleSummary})
   * collapses each slot's per-event sample in `finalize`. Declared by the
   * instance's SUMMARY projection — `pick-category` carries a `statistic` —
   * and always `'mean'` for vector outputs: the vector is the unmarked
   * per-slot mean, and the summary choice belongs to the summary, never to
   * the vector or a recipe param. Recipes without `sampleSummary` ignore it.
   */
  summaryStatistic: SummaryStatistic
}

/**
 * Names for the extremes across AOIs — one phrase per offered reducer stating
 * what that extreme MEANS for this metric ("most-dwelled AOI", "first-reached
 * AOI", "every AOI"). Lowercase noun phrases, so they slot into the mid-dot
 * label grammar: `"Absolute dwell time / ms · most-dwelled AOI"`. Declaration
 * order is presentation order — name the canonical extreme first and the
 * configure UI lists and defaults to it (TTFF names `min`, 'first-reached
 * AOI', before the caveat-laden `max`).
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
  /**
   * The statistical class of the metric's per-participant value — the single
   * declarative property the capability algebra (`core/measurement.ts`) reads to
   * answer every aggregation question (sound cross-participant reductions,
   * matrix-cell reducers, proportional rendering, group-level vs reducible).
   */
  readonly measurementClass: MeasurementClass
  /**
   * The metric's natural cross-participant reduction — the headline used when an
   * instance pins no override. Consulted only for `extensive` metrics (which
   * offer both `mean` and `sum`); `'mean'` for every other class. Counts/summed
   * durations whose cohort total is the conventional reading set `'sum'`.
   */
  readonly defaultReduction: GroupReduction
  /**
   * True unless the recipe explicitly opts out. Windowing compatibility is
   * ultimately gated by `recipeSupports(recipe, projection)` — the effective
   * inner leaf must produce scalar. This flag only lets a recipe say
   * "never windowed" (e.g. time-to-first-fixation).
   */
  readonly supportsWindowing: boolean
  /**
   * True when the recipe writes a meaningful stimulus-level aggregate into
   * the `anyFixationSlot` sentinel (index `aoiCount + 1` of an aoi-vector).
   * Required for the `pick-any-fixation` projection to be allowed.
   */
  readonly providesAnyFixation: boolean
  /**
   * Opt-in to the `aggregate-aoi` projection — reducing the per-AOI vector to
   * ONE AOI's value *within each participant* (the winning AOI can differ
   * between participants). A metric opts in by NAMING what each extreme means:
   * the declared phrase is simultaneously the gate (an unnamed extreme is
   * hidden and rejected), the option the configure UI offers, and the
   * qualifier printed on figures and exports — so the declaration and the
   * disclosure can never drift apart. Only extremes exist here by
   * construction: max/min are order statistics, invariant to how many AOIs
   * the analyst drew, whereas sum/mean/median across AOIs are biased by the
   * segmentation (the stimulus-level total belongs to `providesAnyFixation`).
   * Absent (the default) when no extreme reads clearly — notably metrics
   * carrying a settable Summary `statistic`, whose reducer would compose into
   * an uninterpretable double reduction.
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
  params?: readonly ParamDef<any>[]
  searchTags?: readonly string[]
  /**
   * The metric's statistical class — the one declarative property that drives
   * every aggregation capability (see {@link MeasurementClass}). Required.
   */
  measurementClass: MeasurementClass
  /**
   * The natural cross-participant reduction. Defaults to `'mean'`; set `'sum'`
   * for `extensive` metrics whose conventional headline is the cohort total
   * (counts, summed durations). Ignored for non-`extensive` classes.
   */
  defaultReduction?: GroupReduction
  /** Defaults to true. Set to false when windowing is not meaningful (e.g. TTFF). */
  supportsWindowing?: boolean
  /**
   * The recipe's accumulation semantics — a declaration of what `onFixation`
   * does with each fixation, in the metric's own terms. Required for every
   * scan-trio recipe and forbidden for `scanGroup` recipes (enforced at
   * registration, like the trio itself). It is a CONTRACT, not a hint: for
   * the additive kinds the windowed driver runs the scan as one fused
   * numeric pass over a flat Float64Array (bitmask slot set ≤31 AOI slots,
   * reused scratch array beyond — no FixationEvent, no onFixation call, no
   * per-window accumulators; ~an order of magnitude faster cold), and the
   * result MUST be bit-identical to running the trio per window. The
   * windowed==oracle equivalence suite pins that; the trio remains the
   * definition, used verbatim by every non-windowed query.
   *
   * - `'clippedDuration'` — sums the fixation∩window overlap (ms) per slot
   *   (anyFixation always, noAoi when unlabeled, else each resolved slot).
   * - `'clippedDurationShare'` — same sums, finalized per window as a
   *   percentage of that window's anyFixation total (NaN when it is 0).
   * - `'midpointCount'` — adds 1 per slot in the window(s) containing the
   *   fixation midpoint (the SW-RQA membership convention).
   * - `'stateful'` — anything else (visits, sequences, first-hit latencies):
   *   the accumulator carries cross-fixation state, so windowing runs the
   *   scan trio itself.
   */
  accumulation?: WindowAccumulation
  /**
   * Which segments the per-participant scan iterates.
   *
   * - `'fixationIndex'` (default) — the prebuilt category-0 index; the scan
   *   never reads segment categories (the classic fixation-only engine).
   * - `'categories'` — EVERY segment, with `fix.categorySlot` carrying its
   *   eye-movement-type slot in the canonical displayed-name group order.
   *   For `rawShape: 'category-vector'` recipes: the type is a DIMENSION the
   *   metric ranges over (a value per type), never a parameter — one type is
   *   extracted downstream via the `pick-category` PROJECTION, exactly as
   *   aoi-vector recipes pair with `pick-aoi`. Registration enforces
   *   `rawShape: 'category-vector'` and `accumulation: 'stateful'`: the
   *   fused windowed driver's per-AOI-slot assembly assumes fixation scans,
   *   so category recipes always run the scan trio itself. `onFixation`
   *   receives each segment — the event shape is identical, only the
   *   iteration source differs.
   */
  scanSource?: 'fixationIndex' | 'categories'
  /**
   * Defaults to false. Set to true when the recipe writes a meaningful
   * stimulus-level aggregate into `anyFixationSlot`; opens the
   * `pick-any-fixation` projection for the metric.
   */
  providesAnyFixation?: boolean
  /**
   * Opt-in to the `aggregate-aoi` projection by naming what each extreme
   * across AOIs means for this metric, e.g.
   * `{ max: 'most-dwelled AOI', min: 'least-dwelled AOI' }`. The phrase is
   * the gate, the configure-UI option, and the figure qualifier in one (see
   * {@link MetricMeta.aoiAggregate}). Omit (the default) when no extreme
   * reads clearly — e.g. metrics with a settable Summary `statistic`, whose
   * reducer would compose into a double reduction.
   */
  aoiAggregate?: AoiAggregateLabels
  /**
   * Declares that `finalize` collapses a per-event sample per slot using
   * {@link InitCtx.summaryStatistic} — the gate for statistic-bearing summary
   * projections (a `pick-category` carrying a `statistic`), exactly as
   * `aoiAggregate` gates `aggregate-aoi`. Registration requires an
   * `individuals` recipe (the sample must stay inspectable — distribution
   * plots pool it) and forbids combining with a `statistic` param: the summary
   * choice has ONE declaration channel per metric, never two.
   */
  sampleSummary?: boolean
  /**
   * Author-level veto over specific projections. Receives the full `Projection`
   * — use `p.kind === 'windowed' ? p.inner : p` when the check applies to the
   * leaf regardless of windowing. Return a non-null reason to reject.
   */
  rejects?: (projection: Projection) => string | null

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
