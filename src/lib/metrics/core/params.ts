import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'

type ParamType = 'integer' | 'number' | 'enum' | 'boolean' | 'string'

export interface ParamDef<T> {
  id: string
  label: string
  type: ParamType
  default: T
  /**
   * One-sentence explanation of what the parameter does. Optional today, but
   * required for agent-callable manifests (WebMCP / future MCP surfaces) — the
   * description is what an LLM reads to pick a sensible value. Recipe authors
   * should backfill it for any param whose `label` isn't self-evident.
   */
  description?: string
  min?: number
  max?: number
  step?: number
  unit?: string
  options?: readonly { value: T & string; label: string }[]
  /**
   * Dataset-derived alternative to the static `options` (e.g. eye-movement
   * types, which are interned per dataset at ingest). The configure UI calls
   * it with the live engine at render time; `paramToLabel` cannot resolve a
   * label through it, so pair it with `toLabel`.
   */
  optionsFrom?: (engine: DataEngine) => readonly { value: T & string; label: string }[]
  /**
   * Render this param's value as an instance-label qualifier (mid-dot grammar),
   * or `null`/`''` to omit it (e.g. at a default value that carries no
   * information). When absent, {@link paramToLabel} falls back to a type
   * default: enums show the selected option's label, booleans show the param
   * label when true, numeric/string params are omitted. Opt in here for
   * bespoke phrasing (e.g. `step` → `"2-step"`, shown only when `> 1`).
   */
  toLabel?: (value: T) => string | null | undefined
}

export const integerParam = <ID extends string>(
  id: ID,
  label: string,
  defaultValue: number,
  opts: Partial<
    Omit<ParamDef<number>, 'id' | 'label' | 'type' | 'default'>
  > = {}
): ParamDef<number> & { id: ID } => ({
  id,
  label,
  type: 'integer',
  default: defaultValue,
  ...opts,
})

export const numberParam = <ID extends string>(
  id: ID,
  label: string,
  defaultValue: number,
  opts: Partial<
    Omit<ParamDef<number>, 'id' | 'label' | 'type' | 'default'>
  > = {}
): ParamDef<number> & { id: ID } => ({
  id,
  label,
  type: 'number',
  default: defaultValue,
  ...opts,
})

export const boolParam = <ID extends string>(
  id: ID,
  label: string,
  defaultValue: boolean,
  opts: Partial<Pick<ParamDef<boolean>, 'description' | 'toLabel'>> = {}
): ParamDef<boolean> & { id: ID } => ({
  id,
  label,
  type: 'boolean',
  default: defaultValue,
  ...opts,
})

export const enumParam = <ID extends string, V extends string>(
  id: ID,
  label: string,
  defaultValue: V,
  options: readonly { value: V; label: string }[],
  opts: Partial<
    Pick<ParamDef<V>, 'description' | 'toLabel' | 'optionsFrom'>
  > = {}
): ParamDef<V> & { id: ID } => ({
  id,
  label,
  type: 'enum',
  default: defaultValue,
  options: options as readonly { value: V & string; label: string }[],
  ...opts,
})

/**
 * The shared "Summary" statistic param — how a recipe's per-event values
 * collapse to the per-participant value. Declared ONCE; every summary recipe
 * (fixationDuration, visitDuration, movementDuration, interFixationInterval)
 * imports it. (`sum` is deliberately absent everywhere — totals are their own
 * metrics: absoluteTime, movementTime.)
 */
export const summaryStatisticParam = enumParam<
  'statistic',
  'mean' | 'median' | 'max' | 'min'
>('statistic', 'Summary', 'mean', [
  { value: 'mean', label: 'Mean' },
  { value: 'median', label: 'Median' },
  { value: 'max', label: 'Max' },
  { value: 'min', label: 'Min' },
])

export type ParamsOf<T extends readonly ParamDef<any>[]> = {
  [K in T[number] as K['id']]: K extends ParamDef<infer V> ? V : never
}

export function resolveParams<T extends readonly ParamDef<any>[]>(
  defs: T | undefined,
  raw: Record<string, unknown> | undefined
): ParamsOf<T> {
  const out: Record<string, unknown> = {}
  if (!defs) return out as ParamsOf<T>
  for (const def of defs) {
    const v = raw?.[def.id]
    out[def.id] = v === undefined ? def.default : coerceParam(def, v)
  }
  return out as ParamsOf<T>
}

function coerceParam<T>(def: ParamDef<T>, raw: unknown): T {
  switch (def.type) {
    case 'integer':
      return (typeof raw === 'number' ? Math.trunc(raw) : Number(raw)) as T
    case 'number':
      return Number(raw) as T
    case 'boolean':
      return Boolean(raw) as T
    case 'enum':
      return String(raw) as T
    case 'string':
      return String(raw) as T
  }
}

/**
 * Render a single param value as an instance-label qualifier, or `null` to omit
 * it. THE single rule every label composes from — a param renders identically in
 * the metric selector and on every plot, with no per-metric punctuation. Shows
 * the full operational definition (so a static export is reproducible): enums
 * show the selected option, booleans show the param label when on, numerics show
 * `"Label value [unit]"` (incl. defaults). `toLabel` overrides for short phrasing
 * (e.g. `collapsed` → `"collapsed"`); return `null` from it to omit a value.
 */
export function paramToLabel<T>(def: ParamDef<T>, value: T): string | null {
  if (def.toLabel) {
    const s = def.toLabel(value)
    return s && s.trim() ? s : null
  }
  switch (def.type) {
    case 'enum':
      return def.options?.find(o => o.value === value)?.label ?? null
    case 'boolean':
      return value ? def.label : null
    case 'integer':
    case 'number': {
      const u = def.unit ? ` ${def.unit}` : ''
      return `${def.label} ${value}${u}`
    }
    default:
      return null
  }
}
