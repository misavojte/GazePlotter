import type { OutputShape, WindowUnit } from './dsl'

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

export type AoiRef =
  | { by: 'name'; name: string }
  | { by: 'slot'; slot: number }

export const AOI_REDUCERS = ['mean', 'sum', 'max', 'min', 'median'] as const
export type AoiReducer = typeof AOI_REDUCERS[number]

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
  | 'identity-aoi-pair-matrix'
  | 'identity-participant-pair-matrix'
  | 'pick-aoi'
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
  | { kind: 'identity-aoi-pair-matrix' }
  | { kind: 'identity-participant-pair-matrix' }
  | { kind: 'pick-aoi';          aoiRef: AoiRef }
  | { kind: 'pick-any-fixation' }
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
export type ProjectionKind = LeafProjection['kind'] | 'windowed'

export function identityFor(raw: OutputShape): LeafProjection {
  if (raw === 'scalar')       return { kind: 'identity-scalar' }
  if (raw === 'aoi-vector')   return { kind: 'identity-aoi-vector' }
  if (raw === 'aoi-pair-matrix') return { kind: 'identity-aoi-pair-matrix' }
  if (raw === 'participant-pair-matrix') return { kind: 'identity-participant-pair-matrix' }
  throw new Error(`identityFor: no identity leaf for output shape "${raw}"`)
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
}

export interface ApplyResult {
  values: number[]
  /** True when an AOI reference could not be resolved to a valid slot. */
  aoiMissing: boolean
}

// ─── Registry ───────────────────────────────────────────────────────────────

export interface LeafKindDef {
  outputShape: OutputShape
  rawShapes: readonly OutputShape[]
  label:    (p: LeafProjection) => string
  cacheKey: (p: LeafProjection) => string
  apply:    (p: LeafProjection, ctx: ApplyContext) => ApplyResult
}

const passthrough = (_p: LeafProjection, c: ApplyContext): ApplyResult =>
  ({ values: [...c.rawValues], aoiMissing: false })

export const PROJECTION_LEAVES: Record<LeafKind, LeafKindDef> = {
  'identity-scalar': {
    outputShape: 'scalar',
    rawShapes: ['scalar'],
    label: () => '',
    cacheKey: () => 'id:s',
    apply: passthrough,
  },
  'identity-aoi-vector': {
    outputShape: 'aoi-vector',
    rawShapes: ['aoi-vector'],
    label: () => '',
    cacheKey: () => 'id:v',
    apply: passthrough,
  },
  'identity-aoi-pair-matrix': {
    outputShape: 'aoi-pair-matrix',
    rawShapes: ['aoi-pair-matrix'],
    label: () => '',
    cacheKey: () => 'id:m',
    apply: passthrough,
  },
  'identity-participant-pair-matrix': {
    outputShape: 'participant-pair-matrix',
    rawShapes: ['participant-pair-matrix'],
    label: () => '',
    cacheKey: () => 'id:pm',
    apply: passthrough,
  },
  'pick-aoi': {
    outputShape: 'scalar',
    rawShapes: ['aoi-vector'],
    label:    (p) => aoiRefLabel((p as LeafProjection & { kind: 'pick-aoi' }).aoiRef),
    cacheKey: (p) => `pick:${aoiRefKey((p as LeafProjection & { kind: 'pick-aoi' }).aoiRef)}`,
    apply:    (p, c) => pickAoi((p as LeafProjection & { kind: 'pick-aoi' }).aoiRef, c),
  },
  'pick-any-fixation': {
    outputShape: 'scalar',
    rawShapes: ['aoi-vector'],
    label:    () => 'any fixation',
    cacheKey: () => 'pick:any',
    // Convention: recipes using the aoi-vector output-with-sentinels pattern
    // allocate `aoiCount + 2` slots (aoiCount, noAoiSlot, anyFixationSlot).
    // The any-fixation aggregate is always at index aoiCount + 1.
    apply:    (_p, c) => pickAnyFixation(c),
  },
  'aggregate-aoi': {
    outputShape: 'scalar',
    rawShapes: ['aoi-vector'],
    label:    (p) => `${(p as LeafProjection & { kind: 'aggregate-aoi' }).reducer} across AOIs`,
    cacheKey: (p) => `agg:${(p as LeafProjection & { kind: 'aggregate-aoi' }).reducer}`,
    apply:    (p, c) => aggregateAoi((p as LeafProjection & { kind: 'aggregate-aoi' }).reducer, c),
  },
  'matrix-diagonal': {
    outputShape: 'aoi-vector',
    rawShapes: ['aoi-pair-matrix'],
    label: () => 'diagonal',
    cacheKey: () => 'diag',
    apply: (_p, c) => matrixDiagonal(c),
  },
  'matrix-row': {
    outputShape: 'aoi-vector',
    rawShapes: ['aoi-pair-matrix'],
    label:    (p) => `row ${aoiRefLabel((p as LeafProjection & { kind: 'matrix-row' }).aoiRef)}`,
    cacheKey: (p) => `row:${aoiRefKey((p as LeafProjection & { kind: 'matrix-row' }).aoiRef)}`,
    apply:    (p, c) => matrixRowOrCol((p as LeafProjection & { kind: 'matrix-row' }).aoiRef, c, 'row'),
  },
  'matrix-col': {
    outputShape: 'aoi-vector',
    rawShapes: ['aoi-pair-matrix'],
    label:    (p) => `column ${aoiRefLabel((p as LeafProjection & { kind: 'matrix-col' }).aoiRef)}`,
    cacheKey: (p) => `col:${aoiRefKey((p as LeafProjection & { kind: 'matrix-col' }).aoiRef)}`,
    apply:    (p, c) => matrixRowOrCol((p as LeafProjection & { kind: 'matrix-col' }).aoiRef, c, 'col'),
  },
  'matrix-cell': {
    outputShape: 'scalar',
    rawShapes: ['aoi-pair-matrix'],
    label: (p) => {
      const q = p as LeafProjection & { kind: 'matrix-cell' }
      return `${aoiRefLabel(q.fromAoi)} → ${aoiRefLabel(q.toAoi)}`
    },
    cacheKey: (p) => {
      const q = p as LeafProjection & { kind: 'matrix-cell' }
      return `cell:${aoiRefKey(q.fromAoi)}>${aoiRefKey(q.toAoi)}`
    },
    apply: (p, c) => {
      const q = p as LeafProjection & { kind: 'matrix-cell' }
      return matrixCell(q.fromAoi, q.toAoi, c)
    },
  },
  'matrix-aggregate': {
    outputShape: 'scalar',
    rawShapes: ['aoi-pair-matrix'],
    label: (p) => {
      const q = p as LeafProjection & { kind: 'matrix-aggregate' }
      return q.exclude === 'diagonal'
        ? `${q.reducer} of off-diagonal cells`
        : `${q.reducer} across matrix`
    },
    cacheKey: (p) => {
      const q = p as LeafProjection & { kind: 'matrix-aggregate' }
      return `mat:${q.reducer}${q.exclude === 'diagonal' ? ':off' : ''}`
    },
    apply: (p, c) => {
      const q = p as LeafProjection & { kind: 'matrix-aggregate' }
      return matrixAggregate(q.reducer, q.exclude, c)
    },
  },
}

// Module-load invariant: any future windowable leaf must produce scalar or aoi-vector.
// (The invariant is checked per-instance via recipeSupports at the validation layer.)

// ─── Public dispatchers ─────────────────────────────────────────────────────

export function applyProjection(projection: Projection, ctx: ApplyContext): ApplyResult {
  const leaf = leafOf(projection)
  return PROJECTION_LEAVES[leaf.kind].apply(leaf, ctx)
}

export function projectionOutputShape(projection: Projection): OutputShape {
  if (projection.kind === 'windowed') {
    const innerShape = PROJECTION_LEAVES[projection.inner.kind].outputShape
    return innerShape === 'aoi-vector' ? 'aoi-vector-timeseries' : 'scalar-timeseries'
  }
  return PROJECTION_LEAVES[projection.kind].outputShape
}

export function projectionToLabel(projection: Projection, unit: WindowUnit): string {
  if (projection.kind === 'windowed') {
    const inner = PROJECTION_LEAVES[projection.inner.kind].label(projection.inner)
    const wlabel = windowLabel(projection.window, unit)
    return inner ? `${inner} · ${wlabel}` : wlabel
  }
  return PROJECTION_LEAVES[projection.kind].label(projection)
}

export function projectionCacheKey(projection: Projection): string {
  if (projection.kind === 'windowed') {
    const inner = PROJECTION_LEAVES[projection.inner.kind].cacheKey(projection.inner)
    return `w[${windowKey(projection.window)}]:${inner}`
  }
  return PROJECTION_LEAVES[projection.kind].cacheKey(projection)
}

export function leafOutputShape(leaf: LeafProjection): OutputShape {
  return PROJECTION_LEAVES[leaf.kind].outputShape
}

export function leafRawShapes(kind: LeafKind): readonly OutputShape[] {
  return PROJECTION_LEAVES[kind].rawShapes
}

// ─── Window label / key ─────────────────────────────────────────────────────

/**
 * Standardised human-readable window descriptor used across plot axis
 * labels, instance readouts, and the metric library UI. Format:
 *
 *   - non-overlapping (`stepSize === windowSize`):   `"500 ms window"`
 *   - sliding         (`stepSize !== windowSize`):   `"1000 ms window / 100 ms step"`
 *
 * `unit` is the recipe's `windowUnit` ('ms' for time-windowed, 'fixations'
 * for fixation-windowed RQA recipes; rendered as 'fix' for compactness).
 */
export function windowLabel(w: WindowSpec, unit: WindowUnit): string {
  const u = unit === 'fixations' ? 'fix' : 'ms'
  if (w.stepSize === w.windowSize) {
    return `${w.windowSize} ${u} window`
  }
  return `${w.windowSize} ${u} window / ${w.stepSize} ${u} step`
}

export function windowKey(w: WindowSpec): string {
  return `${w.windowSize}:${w.stepSize}`
}

// ─── Private reshape helpers ────────────────────────────────────────────────

function pickAoi(ref: AoiRef, c: ApplyContext): ApplyResult {
  const slot = resolveAoiRef(ref, c.aoiNames)
  const aoiCount = c.aoiNames.length
  if (slot < 0 || slot >= aoiCount) return { values: [Number.NaN], aoiMissing: true }
  return { values: [c.rawValues[slot] ?? Number.NaN], aoiMissing: false }
}

function pickAnyFixation(c: ApplyContext): ApplyResult {
  // Convention: aoi-vector rawValues has layout [aoi_0, ..., aoi_{n-1}, noAoi, anyFixation].
  // anyFixation lives at index aoiNames.length + 1.
  const idx = c.aoiNames.length + 1
  const v = c.rawValues[idx]
  return { values: [Number.isFinite(v) ? v : Number.NaN], aoiMissing: false }
}

function aggregateAoi(reducer: AoiReducer, c: ApplyContext): ApplyResult {
  const n = c.aoiNames.length
  return { values: [reduceNumeric(c.rawValues.slice(0, n), reducer)], aoiMissing: false }
}

function matrixDiagonal(c: ApplyContext): ApplyResult {
  const side = Math.round(Math.sqrt(c.rawValues.length))
  const aoiCount = c.aoiNames.length
  const out = new Array<number>(aoiCount + 2).fill(Number.NaN)
  for (let i = 0; i < aoiCount && i < side; i++) out[i] = c.rawValues[i * side + i]
  if (side > aoiCount) out[aoiCount] = c.rawValues[aoiCount * side + aoiCount]
  return { values: out, aoiMissing: false }
}

function matrixRowOrCol(ref: AoiRef, c: ApplyContext, axis: 'row' | 'col'): ApplyResult {
  const side = Math.round(Math.sqrt(c.rawValues.length))
  const aoiCount = c.aoiNames.length
  const out = new Array<number>(aoiCount + 2).fill(Number.NaN)
  const slot = resolveAoiRef(ref, c.aoiNames)
  if (slot < 0 || slot >= aoiCount) return { values: out, aoiMissing: true }
  for (let i = 0; i < aoiCount && i < side; i++) {
    out[i] = axis === 'row' ? c.rawValues[slot * side + i] : c.rawValues[i * side + slot]
  }
  if (side > aoiCount) {
    out[aoiCount] = axis === 'row'
      ? c.rawValues[slot * side + aoiCount]
      : c.rawValues[aoiCount * side + slot]
  }
  return { values: out, aoiMissing: false }
}

function matrixCell(fromRef: AoiRef, toRef: AoiRef, c: ApplyContext): ApplyResult {
  const side = Math.round(Math.sqrt(c.rawValues.length))
  const fromSlot = resolveAoiRef(fromRef, c.aoiNames)
  const toSlot   = resolveAoiRef(toRef,   c.aoiNames)
  const validFrom = fromSlot >= 0 && fromSlot < side
  const validTo   = toSlot   >= 0 && toSlot   < side
  if (!validFrom || !validTo) return { values: [Number.NaN], aoiMissing: true }
  return { values: [c.rawValues[fromSlot * side + toSlot] ?? Number.NaN], aoiMissing: false }
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
  if (count === 0) return { values: [Number.NaN], aoiMissing: false }
  switch (reducer) {
    case 'sum':  return { values: [sum], aoiMissing: false }
    case 'mean': return { values: [sum / count], aoiMissing: false }
    case 'max':  return { values: [mx], aoiMissing: false }
    case 'min':  return { values: [mn], aoiMissing: false }
  }
}

function resolveAoiRef(ref: AoiRef, aoiNames: readonly string[]): number {
  if (ref.by === 'slot') return ref.slot
  return aoiNames.findIndex(n => n === ref.name)
}

function reduceNumeric(values: readonly number[], method: AoiReducer): number {
  const valid: number[] = []
  for (const v of values) if (Number.isFinite(v)) valid.push(v)
  if (valid.length === 0) return Number.NaN
  switch (method) {
    case 'sum':  { let s = 0; for (const v of valid) s += v; return s }
    case 'mean': { let s = 0; for (const v of valid) s += v; return s / valid.length }
    case 'max':  { let m = valid[0]; for (let i = 1; i < valid.length; i++) if (valid[i] > m) m = valid[i]; return m }
    case 'min':  { let m = valid[0]; for (let i = 1; i < valid.length; i++) if (valid[i] < m) m = valid[i]; return m }
    case 'median': {
      const s = [...valid].sort((a, b) => a - b)
      const mid = Math.floor(s.length / 2)
      return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]
    }
  }
}

function aoiRefLabel(ref: AoiRef): string {
  return ref.by === 'name' ? `AOI "${ref.name}"` : `slot ${ref.slot}`
}

function aoiRefKey(ref: AoiRef): string {
  return ref.by === 'name' ? `n=${ref.name}` : `s=${ref.slot}`
}
