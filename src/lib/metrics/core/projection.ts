import type { AoiAggregateLabels, Metric, OutputShape, WindowUnit } from './dsl'
import { reduceNumeric, type AoiReducer } from './numeric'
import type { SummaryStatistic } from './params'

/**
 * Projection is a tree: a LeafProjection reshapes one window's raw finalize
 * output, and an optional `windowed` wrapper carries a WindowSpec + an inner
 * leaf that produces a scalar or an aoi-vector. Every registered leaf has one
 * entry in PROJECTION_LEAVES that owns its effective shape, label, cache key,
 * and apply function — all dispatch reduces to a single registry lookup.
 *
 * Synthesized output shapes from windowing:
 *   windowed × scalar-leaf      → 'scalar-timeseries'
 *   windowed × aoi-vector-leaf  → 'aoi-vector-timeseries'
 */

type AoiRef =
  | { by: 'name'; name: string }
  | { by: 'slot'; slot: number }

export const MATRIX_REDUCERS = ['sum', 'mean', 'max', 'min'] as const
export type MatrixReducer = typeof MATRIX_REDUCERS[number]

export interface WindowSpec {
  windowSize: number
  /** Required. `stepSize === windowSize` means non-overlapping (the former "epoch"); anything smaller means sliding/overlapping. */
  stepSize: number
}

// ─── Projection tree ────────────────────────────────────────────────────────

export type LeafKind =
  | 'identity-scalar'
  | 'identity-aoi-vector'
  | 'identity-category-vector'
  | 'identity-aoi-pair-matrix'
  | 'identity-participant-pair-matrix'
  | 'pick-aoi'
  | 'pick-category'
  | 'pick-any-fixation'
  | 'aggregate-aoi'
  | 'matrix-diagonal'
  | 'matrix-row'
  | 'matrix-col'
  | 'matrix-cell'
  | 'matrix-aggregate'

export type LeafProjection =
  | { kind: 'identity-scalar' }
  | { kind: 'identity-aoi-vector' }
  | { kind: 'identity-category-vector' }
  | { kind: 'identity-aoi-pair-matrix' }
  | { kind: 'identity-participant-pair-matrix' }
  /**
   * ── The SUMMARY leaves ────────────────────────────────────────────────
   * The three leaves that collapse a vector to one number. Each may carry
   * `statistic`, the SUMMARY choice for sample-summarizing recipes
   * (`sampleSummary`): the summary statistic belongs to the summary
   * projection, never to the vector or a recipe param. Threaded into the
   * per-participant scan via `InitCtx.summaryStatistic` (so it collapses each
   * participant's sample BEFORE any cross-participant reduction) and gated by
   * `recipeSupports` — a statistic on a sample-less recipe is invalid. It is
   * deliberately absent from the leaf LABEL: the summary is disclosed once, by
   * `summaryStatQualifier`, so it appears on every plot rather than only those
   * printing a projection readout.
   */
  | { kind: 'pick-aoi';          aoiRef: AoiRef; statistic?: SummaryStatistic }
  /** By displayed name only — portable and MERGE-stable, like name AoiRefs. */
  | { kind: 'pick-category';     categoryName: string; statistic?: SummaryStatistic }
  | { kind: 'pick-any-fixation'; statistic?: SummaryStatistic }
  | { kind: 'aggregate-aoi';     reducer: AoiReducer }
  | { kind: 'matrix-diagonal' }
  | { kind: 'matrix-row';        aoiRef: AoiRef }
  | { kind: 'matrix-col';        aoiRef: AoiRef }
  | { kind: 'matrix-cell';       fromAoi: AoiRef; toAoi: AoiRef }
  | { kind: 'matrix-aggregate';  reducer: MatrixReducer; exclude?: 'diagonal' }

export interface WindowedProjection {
  kind: 'windowed'
  window: WindowSpec
  /** Invariant: PROJECTION_LEAVES[inner.kind].outputShape ∈ { 'scalar', 'aoi-vector' }. */
  inner: LeafProjection
}

export type Projection = LeafProjection | WindowedProjection

const IDENTITY_MAP: Record<OutputShape, LeafProjection> = {
  scalar: { kind: 'identity-scalar' },
  'aoi-vector': { kind: 'identity-aoi-vector' },
  'category-vector': { kind: 'identity-category-vector' },
  'aoi-pair-matrix': { kind: 'identity-aoi-pair-matrix' },
  'participant-pair-matrix': { kind: 'identity-participant-pair-matrix' },
  'scalar-timeseries': { kind: 'identity-scalar' },
  'aoi-vector-timeseries': { kind: 'identity-aoi-vector' },
}

export function identityFor(raw: OutputShape): LeafProjection {
  const id = IDENTITY_MAP[raw]
  if (!id) throw new Error(`identityFor: no identity leaf for output shape "${raw}"`)
  return id
}

export function leafOf(p: Projection): LeafProjection {
  return p.kind === 'windowed' ? p.inner : p
}

// ─── Apply context + result ─────────────────────────────────────────────────

export interface ApplyContext {
  /** AOI display names in slot order. length = aoiCount (excluding outside/anyFixation). */
  aoiNames: readonly string[]
  /** Raw finalize output for the current window. */
  rawValues: readonly number[]
  /**
   * Eye-movement-type display names in canonical group order (`categoryGroups`)
   * — the `pick-category` leaf's resolution axis. Only category-vector
   * queries supply it.
   */
  categoryNames?: readonly string[]
}

export interface ApplyResult {
  values: number[]
  /**
   * True when a REFERENCE the projection names could not be resolved to a slot:
   * an AOI (by name or index) for the pick/matrix leaves, an eye-movement type
   * for `pick-category`. Not AOI-specific — a category-vector metric can raise
   * it with no AOI involved at all.
   */
  refMissing: boolean
}

// ─── Registry ───────────────────────────────────────────────────────────────

/**
 * Metric-level naming context for projection labels. Labels are metric-blind
 * except where the metric itself declares the wording: `aggregate-aoi` prints
 * the metric's named meaning for the extreme ("most-dwelled AOI") instead of
 * the generic operator phrase. Callers with an instance in hand
 * (`formatProjectionReadout`) pass the metric's `aoiAggregate` here.
 */
export interface ProjectionLabelContext {
  aoiAggregate?: AoiAggregateLabels
}

export interface LeafKindDef<K extends LeafKind = LeafKind> {
  outputShape: OutputShape
  rawShapes: readonly OutputShape[]
  /**
   * Generic, instance-blind display name of the kind — the configure-metric
   * projection picker's option title. Distinct from {@link LeafKindDef.label},
   * which renders a CONCRETE projection's readout ("most-dwelled AOI", 'type
   * "Saccade"'); this is the kind-level vocabulary.
   */
  title: string
  /** One-line plain-language description of what the kind produces (picker copy). */
  hint: string
  label:    (p: Extract<LeafProjection, { kind: K }>, ctx?: ProjectionLabelContext) => string
  cacheKey: (p: Extract<LeafProjection, { kind: K }>) => string
  apply:    (p: Extract<LeafProjection, { kind: K }>, ctx: ApplyContext) => ApplyResult
}

const passthrough = (_p: LeafProjection, c: ApplyContext): ApplyResult =>
  ({ values: [...c.rawValues], refMissing: false })

/**
 * Cache-key token for a summary leaf's `statistic`. Empty for absent AND for
 * `mean`: an unset statistic resolves to `mean`, so the two describe the same
 * computation and must share one cache entry. Same convention as `rawCacheKey`
 * (runtime.ts), which also omits the mean token.
 */
const statisticKey = (s: SummaryStatistic | undefined): string =>
  s && s !== 'mean' ? `~${s}` : ''

/**
 * An identity leaf: the recipe's own shape, passed through untouched. Five
 * kinds differ only in that shape, their cache token, and their picker copy.
 */
const identityLeaf = <K extends LeafKind>(
  shape: OutputShape,
  key: string,
  title: string,
  hint: string,
): LeafKindDef<K> => ({
  outputShape: shape,
  rawShapes: [shape],
  title,
  hint,
  label: () => '',
  cacheKey: () => key,
  apply: passthrough,
})

export const PROJECTION_LEAVES: { [K in LeafKind]: LeafKindDef<K> } = {
  'identity-scalar': identityLeaf('scalar', 'id:s',
    'Single value', "the metric's single value"),
  'identity-aoi-vector': identityLeaf('aoi-vector', 'id:v',
    'Per AOI', 'one value for each AOI'),
  'identity-category-vector': identityLeaf('category-vector', 'id:cv',
    'Per eye-movement type', 'one value for each eye-movement type'),
  'identity-aoi-pair-matrix': identityLeaf('aoi-pair-matrix', 'id:m',
    'AOI matrix', 'every AOI-to-AOI pair'),
  'identity-participant-pair-matrix': identityLeaf('participant-pair-matrix', 'id:pm',
    'Participant matrix', 'a value for every participant pair'),
  'pick-aoi': {
    outputShape: 'scalar',
    rawShapes: ['aoi-vector'],
    title: 'One AOI',
    hint: 'the value at one chosen AOI',
    label:    (p) => aoiRefLabel(p.aoiRef),
    cacheKey: (p) => `pick:${aoiRefKey(p.aoiRef)}${statisticKey(p.statistic)}`,
    apply:    (p, c) => pickAoi(p.aoiRef, c),
  },
  'pick-category': {
    outputShape: 'scalar',
    rawShapes: ['category-vector'],
    title: 'One type',
    hint: 'the value at one chosen eye-movement type',
    label:    (p) => `type "${p.categoryName}"`,
    cacheKey: (p) => `pickcat:n=${p.categoryName}${statisticKey(p.statistic)}`,
    apply:    (p, c) => pickCategory(p.categoryName, c),
  },
  'pick-any-fixation': {
    outputShape: 'scalar',
    rawShapes: ['aoi-vector'],
    title: 'Whole stimulus',
    hint: 'one number from all fixations together (AOIs ignored)',
    label:    () => 'any fixation',
    cacheKey: (p) => `pick:any${statisticKey(p.statistic)}`,
    // Convention: recipes using the aoi-vector output-with-sentinels pattern
    // allocate `aoiCount + 2` slots (aoiCount, noAoiSlot, anyFixationSlot).
    // The any-fixation aggregate is always at index aoiCount + 1.
    apply:    (_p, c) => pickAnyFixation(c),
  },
  'aggregate-aoi': {
    outputShape: 'scalar',
    rawShapes: ['aoi-vector'],
    title: 'Highest / lowest AOI',
    hint: 'the highest- or lowest-scoring AOI, per participant',
    // The metric's named meaning of the extreme when provided ("most-dwelled
    // AOI"); the generic operator phrase only as a metric-less fallback.
    label: (p, ctx) => {
      const named =
        p.reducer === 'max' || p.reducer === 'min'
          ? ctx?.aoiAggregate?.[p.reducer]
          : undefined
      return named || `${p.reducer} across AOIs`
    },
    cacheKey: (p) => `agg:${p.reducer}`,
    apply:    (p, c) => aggregateAoi(p.reducer, c),
  },
  'matrix-diagonal': {
    outputShape: 'aoi-vector',
    rawShapes: ['aoi-pair-matrix'],
    title: 'Self-transitions',
    hint: "each AOI's transitions to itself",
    label: () => 'self-transitions',
    cacheKey: () => 'diag',
    apply: (_p, c) => matrixDiagonal(c),
  },
  'matrix-row': {
    outputShape: 'aoi-vector',
    rawShapes: ['aoi-pair-matrix'],
    title: 'From an AOI',
    hint: 'transitions leaving one chosen AOI',
    label:    (p) => `from ${aoiRefLabel(p.aoiRef)}`,
    cacheKey: (p) => `row:${aoiRefKey(p.aoiRef)}`,
    apply:    (p, c) => matrixRowOrCol(p.aoiRef, c, 'row'),
  },
  'matrix-col': {
    outputShape: 'aoi-vector',
    rawShapes: ['aoi-pair-matrix'],
    title: 'To an AOI',
    hint: 'transitions arriving at one chosen AOI',
    label:    (p) => `to ${aoiRefLabel(p.aoiRef)}`,
    cacheKey: (p) => `col:${aoiRefKey(p.aoiRef)}`,
    apply:    (p, c) => matrixRowOrCol(p.aoiRef, c, 'col'),
  },
  'matrix-cell': {
    outputShape: 'scalar',
    rawShapes: ['aoi-pair-matrix'],
    title: 'One transition',
    hint: 'a single from → to AOI pair',
    label:    (p) => `${aoiRefLabel(p.fromAoi)} → ${aoiRefLabel(p.toAoi)}`,
    cacheKey: (p) => `cell:${aoiRefKey(p.fromAoi)}>${aoiRefKey(p.toAoi)}`,
    apply:    (p, c) => matrixCell(p.fromAoi, p.toAoi, c),
  },
  'matrix-aggregate': {
    outputShape: 'scalar',
    rawShapes: ['aoi-pair-matrix'],
    title: 'Matrix summary',
    hint: 'one number for the whole matrix',
    label: (p) =>
      p.exclude === 'diagonal'
        ? `${p.reducer} excluding self-transitions`
        : `${p.reducer} across all pairs`,
    cacheKey: (p) => `mat:${p.reducer}${p.exclude === 'diagonal' ? ':off' : ''}`,
    apply:    (p, c) => matrixAggregate(p.reducer, p.exclude, c),
  },
}

// Module-load invariant: any future windowable leaf must produce scalar or aoi-vector.
// (The invariant is checked per-instance via recipeSupports at the validation layer.)

// ─── Public dispatchers ─────────────────────────────────────────────────────

/**
 * Registry lookup for a leaf whose kind is only known as the union — the ONE
 * localized cast correlating `leaf` with its `PROJECTION_LEAVES` entry (a
 * union-typed leaf can't call a per-kind def's methods directly).
 */
export function leafDef(leaf: LeafProjection): LeafKindDef {
  return PROJECTION_LEAVES[leaf.kind] as LeafKindDef
}

export function applyProjection(projection: Projection, ctx: ApplyContext): ApplyResult {
  const leaf = leafOf(projection)
  return leafDef(leaf).apply(leaf, ctx)
}

/**
 * The summary statistic an instance's projection declares — `'mean'` unless
 * the leaf is one of the SUMMARY leaves carrying an explicit choice. The
 * runtime threads this into the scan ctx (`InitCtx.summaryStatistic`) so
 * sample-summarizing recipes collapse each participant's sample with it in
 * `finalize`; a non-mean value also keys the raw cache (see `rawCacheKey`).
 * The `apply` step stays a plain slot select — by the time a projection runs,
 * the vector is already collapsed per slot.
 *
 * Identity leaves resolve to `mean` and have nowhere to say otherwise: a
 * VECTOR is the unmarked per-slot mean, which is the whole point of moving the
 * choice onto the summary.
 */
export function projectionSummaryStatistic(p: Projection): SummaryStatistic {
  return leafSummaryStatistic(leafOf(p)) ?? 'mean'
}

/** The three leaves that collapse a vector to one number (see the union). */
export type SummaryLeaf = Extract<
  LeafProjection,
  { kind: 'pick-aoi' | 'pick-category' | 'pick-any-fixation' }
>

/**
 * THE predicate for "this leaf produces a summary, so it may carry a
 * `statistic`". One declaration, read by the validator's gate, the label
 * layer, and the configure modal's Summary select — a fourth summary leaf
 * joins all three by editing this list alone.
 */
export function isSummaryLeafKind(kind: LeafKind): kind is SummaryLeaf['kind'] {
  return kind === 'pick-aoi' || kind === 'pick-category' || kind === 'pick-any-fixation'
}

export function isSummaryLeaf(leaf: LeafProjection): leaf is SummaryLeaf {
  return isSummaryLeafKind(leaf.kind)
}

/**
 * The statistic a leaf explicitly CARRIES, or `undefined` when it carries none
 * (an identity leaf, a non-summary leaf, or a summary leaf on a recipe without
 * a sample). Distinct from {@link projectionSummaryStatistic}, which resolves
 * the absent case to `mean`: the label layer needs the distinction, because a
 * collapse nobody chose is not disclosed as a choice.
 */
export function leafSummaryStatistic(leaf: LeafProjection): SummaryStatistic | undefined {
  return isSummaryLeaf(leaf) ? leaf.statistic : undefined
}

export function projectionOutputShape(projection: Projection): OutputShape {
  if (projection.kind === 'windowed') {
    const innerShape = PROJECTION_LEAVES[projection.inner.kind].outputShape
    return innerShape === 'aoi-vector' ? 'aoi-vector-timeseries' : 'scalar-timeseries'
  }
  return PROJECTION_LEAVES[projection.kind].outputShape
}

/**
 * How much of a projection a readout prints. A projection states TWO
 * independent things, and a caller can already be showing one of them:
 *
 *   - `'leaf'`  WHICH slice ('AOI "Logo"', 'type "Saccade"', a matrix cell).
 *   - `'full'`  that slice plus HOW it is cut over time (the window).
 *
 * Time-axis plots (Metric Timeline, AOI Timeline) draw the window on the x
 * axis, so they ask for `'leaf'`: printing `'full'` would state the window
 * twice, and printing nothing at all used to drop the slice with it, leaving
 * two plots of different AOIs wearing identical axis labels.
 */
export type ProjectionLabelPart = 'leaf' | 'full'

export function projectionToLabel(
  projection: Projection,
  unit: WindowUnit,
  ctx?: ProjectionLabelContext,
  part: ProjectionLabelPart = 'full',
): string {
  const leaf = leafOf(projection)
  const label = leafDef(leaf).label(leaf, ctx)
  if (part === 'leaf' || projection.kind !== 'windowed') return label
  const wlabel = windowLabel(projection.window, unit)
  return label ? `${label} · ${wlabel}` : wlabel
}

export function projectionCacheKey(projection: Projection): string {
  if (projection.kind === 'windowed') {
    const inner = leafDef(projection.inner).cacheKey(projection.inner)
    return `w[${windowKey(projection.window)}]:${inner}`
  }
  return leafDef(projection).cacheKey(projection)
}

// ─── Window label / key ─────────────────────────────────────────────────────

/**
 * Standardised human-readable window descriptor used across plot axis
 * labels, instance readouts, and the metric library UI. Format:
 *
 *   - non-overlapping (`stepSize === windowSize`):   `"500 ms window"`
 *   - sliding         (`stepSize !== windowSize`):   `"1000 ms window, 100 ms step"`
 *
 * `unit` is the recipe's `windowUnit` ('ms' for time-windowed, 'fixations'
 * for fixation-windowed RQA recipes; rendered as 'fix' for compactness). The
 * window/step pair is comma-separated, not slash-separated: `/` is reserved
 * for the IUPAC quantity/unit separator in axis/legend labels.
 */
export function windowLabel(w: WindowSpec, unit: WindowUnit): string {
  const u = unit === 'fixations' ? 'fix' : 'ms'
  if (w.stepSize === w.windowSize) {
    return `${w.windowSize} ${u} window`
  }
  return `${w.windowSize} ${u} window, ${w.stepSize} ${u} step`
}

export function windowKey(w: WindowSpec): string {
  return `${w.windowSize}:${w.stepSize}`
}

// ─── Private reshape helpers ────────────────────────────────────────────────

function pickAoi(ref: AoiRef, c: ApplyContext): ApplyResult {
  const slot = resolveAoiRef(ref, c.aoiNames)
  const aoiCount = c.aoiNames.length
  if (slot < 0 || slot >= aoiCount) return { values: [Number.NaN], refMissing: true }
  return { values: [c.rawValues[slot] ?? Number.NaN], refMissing: false }
}

function pickCategory(name: string, c: ApplyContext): ApplyResult {
  // Trimmed compare — the canonical displayed-name matching rule
  // (groupByDisplayedName), so a ref never misses on stray whitespace.
  const wanted = name.trim()
  const slot = (c.categoryNames ?? []).findIndex(n => n.trim() === wanted)
  if (slot < 0) return { values: [Number.NaN], refMissing: true }
  return { values: [c.rawValues[slot] ?? Number.NaN], refMissing: false }
}

function pickAnyFixation(c: ApplyContext): ApplyResult {
  // Convention: aoi-vector rawValues has layout [aoi_0, ..., aoi_{n-1}, noAoi, anyFixation].
  // anyFixation lives at index aoiNames.length + 1.
  const idx = c.aoiNames.length + 1
  const v = c.rawValues[idx]
  return { values: [Number.isFinite(v) ? v : Number.NaN], refMissing: false }
}

function aggregateAoi(reducer: AoiReducer, c: ApplyContext): ApplyResult {
  const n = c.aoiNames.length
  return { values: [reduceNumeric(c.rawValues.slice(0, n), reducer)], refMissing: false }
}

function matrixDiagonal(c: ApplyContext): ApplyResult {
  const side = Math.round(Math.sqrt(c.rawValues.length))
  const aoiCount = c.aoiNames.length
  const out = new Array<number>(aoiCount + 2).fill(Number.NaN)
  for (let i = 0; i < aoiCount && i < side; i++) out[i] = c.rawValues[i * side + i]
  if (side > aoiCount) out[aoiCount] = c.rawValues[aoiCount * side + aoiCount]
  return { values: out, refMissing: false }
}

function matrixRowOrCol(ref: AoiRef, c: ApplyContext, axis: 'row' | 'col'): ApplyResult {
  const side = Math.round(Math.sqrt(c.rawValues.length))
  const aoiCount = c.aoiNames.length
  const out = new Array<number>(aoiCount + 2).fill(Number.NaN)
  const slot = resolveAoiRef(ref, c.aoiNames)
  if (slot < 0 || slot >= aoiCount) return { values: out, refMissing: true }
  for (let i = 0; i < aoiCount && i < side; i++) {
    out[i] = axis === 'row' ? c.rawValues[slot * side + i] : c.rawValues[i * side + slot]
  }
  if (side > aoiCount) {
    out[aoiCount] = axis === 'row'
      ? c.rawValues[slot * side + aoiCount]
      : c.rawValues[aoiCount * side + slot]
  }
  return { values: out, refMissing: false }
}

function matrixCell(fromRef: AoiRef, toRef: AoiRef, c: ApplyContext): ApplyResult {
  const side = Math.round(Math.sqrt(c.rawValues.length))
  const fromSlot = resolveAoiRef(fromRef, c.aoiNames)
  const toSlot   = resolveAoiRef(toRef,   c.aoiNames)
  const validFrom = fromSlot >= 0 && fromSlot < side
  const validTo   = toSlot   >= 0 && toSlot   < side
  if (!validFrom || !validTo) return { values: [Number.NaN], refMissing: true }
  return { values: [c.rawValues[fromSlot * side + toSlot] ?? Number.NaN], refMissing: false }
}

function matrixAggregate(
  reducer: MatrixReducer,
  exclude: 'diagonal' | undefined,
  c: ApplyContext,
): ApplyResult {
  const side = Math.round(Math.sqrt(c.rawValues.length))
  const excludeDiag = exclude === 'diagonal'
  let sum = 0
  let count = 0
  let mn = Infinity
  let mx = -Infinity
  for (let i = 0; i < side; i++) {
    for (let j = 0; j < side; j++) {
      if (excludeDiag && i === j) continue
      const v = c.rawValues[i * side + j]
      if (!Number.isFinite(v)) continue
      sum += v
      count++
      if (v < mn) mn = v
      if (v > mx) mx = v
    }
  }
  if (count === 0) return { values: [Number.NaN], refMissing: false }
  switch (reducer) {
    case 'sum':  return { values: [sum], refMissing: false }
    case 'mean': return { values: [sum / count], refMissing: false }
    case 'max':  return { values: [mx], refMissing: false }
    case 'min':  return { values: [mn], refMissing: false }
  }
}

function resolveAoiRef(ref: AoiRef, aoiNames: readonly string[]): number {
  if (ref.by === 'slot') return ref.slot
  return aoiNames.findIndex(n => n === ref.name)
}

function aoiRefLabel(ref: AoiRef): string {
  return ref.by === 'name' ? `AOI "${ref.name}"` : `slot ${ref.slot}`
}

function aoiRefKey(ref: AoiRef): string {
  return ref.by === 'name' ? `n=${ref.name}` : `s=${ref.slot}`
}
