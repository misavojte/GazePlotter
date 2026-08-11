type ParamType = 'integer' | 'number' | 'enum' | 'boolean' | 'string'

export interface ParamDef<T> {
  id: string
  label: string
  type: ParamType
  default: T
  /** Backfill for any param whose `label` isn't self-evident. */
  description?: string
  min?: number
  max?: number
  step?: number
  unit?: string
  options?: readonly { value: T & string; label: string }[]
  /** Bespoke phrasing for the instance-label qualifier (`step` → `"2-step"`,
   *  shown only when `> 1`); `null`/`''` omits it. See {@link paramToLabel}
   *  for the type defaults this overrides. */
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
  opts: Partial<Pick<ParamDef<V>, 'description' | 'toLabel'>> = {}
): ParamDef<V> & { id: ID } => ({
  id,
  label,
  type: 'enum',
  default: defaultValue,
  options: options as readonly { value: V & string; label: string }[],
  ...opts,
})

/**
 * How a per-event sample collapses to one per-participant value. `sum` is
 * absent: totals are their own metrics (absoluteTime, movementTime).
 */
export type SummaryStatistic = 'mean' | 'median' | 'max' | 'min'

/**
 * The configure UI's Summary select. Exactly ONE place declares a summary
 * statistic — the SUMMARY projection; a recipe-level `statistic` param is
 * rejected at registration.
 *
 * Accepted consequence: a plot consuming the raw VECTOR always shows the
 * per-slot mean, having nowhere to say otherwise. That is the rule.
 */
export const SUMMARY_STATISTIC_OPTIONS = [
  { value: 'mean', label: 'Mean' },
  { value: 'median', label: 'Median' },
  { value: 'max', label: 'Max' },
  { value: 'min', label: 'Min' },
] as const satisfies readonly { value: SummaryStatistic; label: string }[]

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
 * THE single rule every label composes from, so a param renders identically in
 * the metric selector and on every plot. Shows the full operational definition,
 * defaults included, to keep a static export reproducible: enums show the
 * selected option, booleans the param label when on, numerics
 * `"Label value [unit]"`. `toLabel` overrides; `null` omits.
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
