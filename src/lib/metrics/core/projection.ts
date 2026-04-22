import type { OutputShape } from './dsl'

/**
 * Projection is a tree: a LeafProjection reshapes one window's raw finalize
 * output, and an optional `windowed` wrapper carries a WindowSpec + an inner
 * leaf that produces a scalar. Every registered leaf has one entry in
 * PROJECTION_LEAVES that owns its effective shape, label, cache key, and
 * apply function — all dispatch reduces to a single registry lookup.
 */

export type AoiRef =
  | { by: 'name'; name: string }
  | { by: 'slot'; slot: number }

export type AoiReducer    = 'mean' | 'sum' | 'max' | 'min' | 'median'
export type MatrixReducer = 'mean' | 'sum'

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
  | 'pick-aoi'
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
  | { kind: 'pick-aoi';          aoiRef: AoiRef }
  | { kind: 'aggregate-aoi';     reducer: AoiReducer }
  | { kind: 'matrix-diagonal' }
  | { kind: 'matrix-row';        aoiRef: AoiRef }
  | { kind: 'matrix-col';        aoiRef: AoiRef }
  | { kind: 'matrix-cell';       fromAoi: AoiRef; toAoi: AoiRef }
  | { kind: 'matrix-aggregate';  reducer: MatrixReducer; exclude?: 'diagonal' }

export interface WindowedProjection {
  kind: 'windowed'
  window: WindowSpec
  /** Invariant: PROJECTION_LEAVES[inner.kind].outputShape === 'scalar'. */
  inner: LeafProjection
}

export type Projection = LeafProjection | WindowedProjection
export type ProjectionKind = LeafProjection['kind'] | 'windowed'

export function identityFor(raw: OutputShape): LeafProjection {
  if (raw === 'scalar')       return { kind: 'identity-scalar' }
  if (raw === 'aoi-vector')   return { kind: 'identity-aoi-vector' }
  if (raw === 'aoi-pair-matrix') return { kind: 'identity-aoi-pair-matrix' }
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
  'pick-aoi': {
    outputShape: 'scalar',
    rawShapes: ['aoi-vector'],
    label:    (p) => aoiRefLabel((p as LeafProjection & { kind: 'pick-aoi' }).aoiRef),
    cacheKey: (p) => `pick:${aoiRefKey((p as LeafProjection & { kind: 'pick-aoi' }).aoiRef)}`,
    apply:    (p, c) => pickAoi((p as LeafProjection & { kind: 'pick-aoi' }).aoiRef, c),
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

// Module-load invariant: any future windowed-by-default leaf must produce scalar.
// (The invariant is checked per-instance via recipeSupports at the validation layer.)

// ─── Public dispatchers ─────────────────────────────────────────────────────

export function applyProjection(projection: Projection, ctx: ApplyContext): ApplyResult {
  const leaf = leafOf(projection)
  return PROJECTION_LEAVES[leaf.kind].apply(leaf, ctx)
}

export function projectionOutputShape(projection: Projection): OutputShape {
  if (projection.kind === 'windowed') return 'scalar-timeseries'
  return PROJECTION_LEAVES[projection.kind].outputShape
}

export function projectionToLabel(projection: Projection): string {
  if (projection.kind === 'windowed') {
    const inner = PROJECTION_LEAVES[projection.inner.kind].label(projection.inner)
    const wlabel = windowLabel(projection.window)
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

export function windowLabel(w: WindowSpec): string {
  const step = w.stepSize !== w.windowSize ? ` / ${w.stepSize} step` : ''
  return `Window ${w.windowSize}${step}`
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
  for (let i = 0; i < side; i++) {
    for (let j = 0; j < side; j++) {
      if (excludeDiag && i === j) continue
      const v = c.rawValues[i * side + j]
      if (!Number.isFinite(v)) continue
      sum += v
      count++
    }
  }
  if (count === 0) return { values: [Number.NaN], aoiMissing: false }
  return { values: [reducer === 'sum' ? sum : sum / count], aoiMissing: false }
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
