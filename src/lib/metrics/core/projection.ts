import type { OutputShape } from './dsl'

/**
 * A projection reshapes a recipe's raw output into something a consumer
 * (bar plot, correlation, sliding window, …) can digest. It has TWO axes:
 *
 *   1. `target`  — the effective output shape (scalar | aoi-vector | aoi-pair-matrix).
 *                  Consumer context filtering is based ONLY on this — if a
 *                  projection's target matches the context's accepted shapes,
 *                  the instance is eligible, regardless of the recipe's raw
 *                  output shape.
 *
 *   2. `from`    — how to derive the target from the recipe's raw output.
 *                  Different `from` values are legal for different raw shapes;
 *                  method-specific parameters (AOI refs, reducers) travel
 *                  alongside.
 *
 * Projection is applied AFTER `finalize` and AFTER windowing reduction, so
 * recipes stay shape-stable and windowing+projection compose orthogonally:
 * a windowed recipe still produces raw-shape output per scan, which the
 * projection then reshapes once at the end.
 */

export type ProjectionShape = OutputShape

export type AoiRef =
  | { by: 'name'; name: string }
  | { by: 'slot'; slot: number }

export type AoiReducer = 'mean' | 'sum' | 'max' | 'min' | 'median'
export type MatrixReducer = 'mean' | 'sum'

export type Projection =
  // → scalar
  | { target: 'scalar'; from: 'identity' }
  | { target: 'scalar'; from: 'pick-aoi'; aoiRef: AoiRef }
  | { target: 'scalar'; from: 'aggregate-aoi'; reducer: AoiReducer }
  | { target: 'scalar'; from: 'matrix-aggregate'; reducer: MatrixReducer; exclude?: 'diagonal' }
  | { target: 'scalar'; from: 'matrix-cell'; fromAoi: AoiRef; toAoi: AoiRef }
  // → aoi-vector
  | { target: 'aoi-vector'; from: 'identity' }
  | { target: 'aoi-vector'; from: 'matrix-diagonal' }
  | { target: 'aoi-vector'; from: 'matrix-row'; aoiRef: AoiRef }
  | { target: 'aoi-vector'; from: 'matrix-col'; aoiRef: AoiRef }
  // → aoi-pair-matrix
  | { target: 'aoi-pair-matrix'; from: 'identity' }

export const IDENTITY_PROJECTION = { target: 'scalar', from: 'identity' } as const

/** Identity projection for the given raw output shape. */
export function identityFor(raw: OutputShape): Projection {
  return { target: raw, from: 'identity' }
}

// ─── Compatibility matrix ───────────────────────────────────────────────────

/**
 * Which `from` methods are legal given the recipe's raw output shape and the
 * consumer's desired target shape. Used by the UI to populate method pickers
 * and by `isProjectionValid` below.
 */
export function fromMethodsFor(
  raw: OutputShape,
  target: ProjectionShape
): Projection['from'][] {
  if (raw === target) return ['identity']
  if (raw === 'aoi-vector' && target === 'scalar')
    return ['pick-aoi', 'aggregate-aoi']
  if (raw === 'aoi-pair-matrix' && target === 'aoi-vector')
    return ['matrix-diagonal', 'matrix-row', 'matrix-col']
  if (raw === 'aoi-pair-matrix' && target === 'scalar')
    return ['matrix-cell', 'matrix-aggregate']
  return []
}

/** All target shapes this recipe's raw shape can be projected to. */
export function targetsFor(raw: OutputShape): ProjectionShape[] {
  const all: ProjectionShape[] = ['scalar', 'aoi-vector', 'aoi-pair-matrix']
  return all.filter(t => fromMethodsFor(raw, t).length > 0)
}

export function computeEffectiveShape(
  raw: OutputShape,
  projection: Projection | undefined
): OutputShape {
  return projection?.target ?? raw
}

export function isProjectionValid(
  raw: OutputShape,
  projection: Projection | undefined
): boolean {
  const p = projection ?? { target: raw, from: 'identity' as const }
  return fromMethodsFor(raw, p.target).includes(p.from)
}

// ─── Apply ──────────────────────────────────────────────────────────────────

export interface ProjectionContext {
  /** AOI display names in slot order. length = aoiCount. */
  aoiNames: readonly string[]
}

export interface ApplyResult {
  values: number[]
  /** True if an AOI reference could not be resolved to a slot. */
  aoiMissing: boolean
}

export function applyProjection(
  raw: readonly number[],
  rawShape: OutputShape,
  projection: Projection | undefined,
  ctx: ProjectionContext
): ApplyResult {
  const p = projection ?? { target: rawShape, from: 'identity' as const }

  if (p.from === 'identity') return { values: [...raw], aoiMissing: false }

  const aoiCount = ctx.aoiNames.length

  if (rawShape === 'aoi-vector' && p.target === 'scalar') {
    if (p.from === 'pick-aoi') {
      const slot = resolveAoiRef(p.aoiRef, ctx.aoiNames)
      if (slot < 0 || slot >= aoiCount) return { values: [Number.NaN], aoiMissing: true }
      return { values: [raw[slot] ?? Number.NaN], aoiMissing: false }
    }
    if (p.from === 'aggregate-aoi') {
      return { values: [reduceNumeric(raw.slice(0, aoiCount), p.reducer)], aoiMissing: false }
    }
  }

  if (rawShape === 'aoi-pair-matrix') {
    // side = aoiCount + 1 (outside slot at index aoiCount)
    const side = Math.round(Math.sqrt(raw.length))

    if (p.target === 'aoi-vector' && p.from === 'matrix-diagonal') {
      const out = new Array<number>(aoiCount + 2).fill(Number.NaN)
      for (let i = 0; i < aoiCount && i < side; i++) out[i] = raw[i * side + i]
      if (side > aoiCount) out[aoiCount] = raw[aoiCount * side + aoiCount]
      return { values: out, aoiMissing: false }
    }
    if (p.target === 'aoi-vector' && (p.from === 'matrix-row' || p.from === 'matrix-col')) {
      const out = new Array<number>(aoiCount + 2).fill(Number.NaN)
      const slot = resolveAoiRef(p.aoiRef, ctx.aoiNames)
      if (slot < 0 || slot >= aoiCount) return { values: out, aoiMissing: true }
      for (let i = 0; i < aoiCount && i < side; i++) {
        out[i] = p.from === 'matrix-row' ? raw[slot * side + i] : raw[i * side + slot]
      }
      if (side > aoiCount) {
        out[aoiCount] = p.from === 'matrix-row'
          ? raw[slot * side + aoiCount]
          : raw[aoiCount * side + slot]
      }
      return { values: out, aoiMissing: false }
    }
    if (p.target === 'scalar' && p.from === 'matrix-cell') {
      const fromSlot = resolveAoiRef(p.fromAoi, ctx.aoiNames)
      const toSlot = resolveAoiRef(p.toAoi, ctx.aoiNames)
      // Outside-AOI row/col lives at index aoiCount (= side - 1).
      const validFrom = fromSlot >= 0 && fromSlot < side
      const validTo = toSlot >= 0 && toSlot < side
      if (!validFrom || !validTo) return { values: [Number.NaN], aoiMissing: true }
      return { values: [raw[fromSlot * side + toSlot] ?? Number.NaN], aoiMissing: false }
    }
    if (p.target === 'scalar' && p.from === 'matrix-aggregate') {
      const excludeDiag = p.exclude === 'diagonal'
      let sum = 0
      let count = 0
      for (let i = 0; i < side; i++) {
        for (let j = 0; j < side; j++) {
          if (excludeDiag && i === j) continue
          const v = raw[i * side + j]
          if (!Number.isFinite(v)) continue
          sum += v
          count++
        }
      }
      if (count === 0) return { values: [Number.NaN], aoiMissing: false }
      return {
        values: [p.reducer === 'sum' ? sum : sum / count],
        aoiMissing: false,
      }
    }
  }

  // Invalid combination — fall back to passthrough so callers don't see undefined.
  return { values: [...raw], aoiMissing: false }
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

// ─── Label / key helpers ────────────────────────────────────────────────────

export function projectionToLabel(p: Projection | undefined): string {
  if (!p || p.from === 'identity') return ''
  switch (p.from) {
    case 'pick-aoi':         return aoiRefLabel(p.aoiRef)
    case 'aggregate-aoi':    return `${p.reducer} across AOIs`
    case 'matrix-diagonal':  return 'diagonal'
    case 'matrix-row':       return `row ${aoiRefLabel(p.aoiRef)}`
    case 'matrix-col':       return `column ${aoiRefLabel(p.aoiRef)}`
    case 'matrix-aggregate': return p.exclude === 'diagonal'
      ? `${p.reducer} of off-diagonal cells`
      : `${p.reducer} across matrix`
    case 'matrix-cell':      return `${aoiRefLabel(p.fromAoi)} → ${aoiRefLabel(p.toAoi)}`
  }
}

function aoiRefLabel(ref: AoiRef): string {
  return ref.by === 'name' ? `AOI "${ref.name}"` : `slot ${ref.slot}`
}

/** Stable key fragment for caches & equality. */
export function projectionKey(p: Projection | undefined): string {
  if (!p || p.from === 'identity') return `id:${p?.target ?? '?'}`
  switch (p.from) {
    case 'pick-aoi':         return `pick:${aoiRefKey(p.aoiRef)}`
    case 'aggregate-aoi':    return `agg:${p.reducer}`
    case 'matrix-diagonal':  return 'diag'
    case 'matrix-row':       return `row:${aoiRefKey(p.aoiRef)}`
    case 'matrix-col':       return `col:${aoiRefKey(p.aoiRef)}`
    case 'matrix-aggregate': return `mat:${p.reducer}${p.exclude === 'diagonal' ? ':off' : ''}`
    case 'matrix-cell':      return `cell:${aoiRefKey(p.fromAoi)}>${aoiRefKey(p.toAoi)}`
  }
}

function aoiRefKey(ref: AoiRef): string {
  return ref.by === 'name' ? `n=${ref.name}` : `s=${ref.slot}`
}

// ─── Back-compat helpers retained for the old top-level `kind` field ────────

/** @deprecated Kept for transitional call sites; use `fromMethodsFor` instead. */
export function projectionKindsFor(raw: OutputShape): Projection['from'][] {
  const set = new Set<Projection['from']>()
  for (const target of targetsFor(raw)) {
    for (const from of fromMethodsFor(raw, target)) set.add(from)
  }
  return Array.from(set)
}
