export type ParamType = 'integer' | 'number' | 'enum' | 'boolean' | 'string'

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
  options: readonly { value: V; label: string }[]
): ParamDef<V> & { id: ID } => ({
  id,
  label,
  type: 'enum',
  default: defaultValue,
  options: options as readonly { value: V & string; label: string }[],
})

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
 * it. The single rule every metric's auto-label composes from — so a param
 * renders identically wherever it appears, with no per-metric punctuation.
 * `toLabel` wins; otherwise enums show the selected option's label, booleans
 * show the param label when true, numeric/string params are omitted.
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
    default:
      return null
  }
}
