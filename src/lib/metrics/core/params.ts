export type ParamType = 'integer' | 'number' | 'enum' | 'boolean' | 'string'

export interface ParamDef<T> {
  id: string
  label: string
  type: ParamType
  default: T
  min?: number
  max?: number
  step?: number
  unit?: string
  options?: readonly { value: T & string; label: string }[]
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
  defaultValue: boolean
): ParamDef<boolean> & { id: ID } => ({
  id,
  label,
  type: 'boolean',
  default: defaultValue,
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

/**
 * Emit a JSON Schema fragment for one param. Paired with ProjectionSchema /
 * WindowingConfigSchema in `./schemas.ts` to form a complete instance-creation
 * schema that a future WebMCP server can validate without pulling a generator.
 */
export function paramToJsonSchema(def: ParamDef<any>): Record<string, unknown> {
  switch (def.type) {
    case 'integer':
      return {
        type: 'integer',
        default: def.default,
        ...(def.min !== undefined ? { minimum: def.min } : {}),
        ...(def.max !== undefined ? { maximum: def.max } : {}),
        ...(def.unit ? { 'x-unit': def.unit } : {}),
      }
    case 'number':
      return {
        type: 'number',
        default: def.default,
        ...(def.min !== undefined ? { minimum: def.min } : {}),
        ...(def.max !== undefined ? { maximum: def.max } : {}),
        ...(def.unit ? { 'x-unit': def.unit } : {}),
      }
    case 'boolean':
      return { type: 'boolean', default: def.default }
    case 'enum':
      return {
        type: 'string',
        enum: (def.options ?? []).map(o => o.value),
        default: def.default,
      }
    case 'string':
      return { type: 'string', default: def.default }
  }
}

/** JSON Schema for a recipe's full params bag: { [paramId]: paramSchema }. */
export function paramsSchemaFor(defs: readonly ParamDef<any>[] | undefined): Record<string, unknown> {
  const properties: Record<string, unknown> = {}
  const required: string[] = []
  for (const d of defs ?? []) {
    properties[d.id] = paramToJsonSchema(d)
    required.push(d.id)
  }
  return {
    type: 'object',
    additionalProperties: false,
    properties,
    ...(required.length ? { required } : {}),
  }
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
