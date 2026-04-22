/**
 * Hand-written JSON Schema for the Projection discriminated tree.
 * Used by future WebMCP / LLM tool surfaces to validate instance creation
 * payloads without pulling a schema generator.
 */
import { AOI_REDUCERS, MATRIX_REDUCERS } from './projection'

const WindowSpecSchema = {
  type: 'object',
  required: ['windowSize', 'stepSize'],
  additionalProperties: false,
  properties: {
    windowSize: { type: 'number', minimum: 1 },
    stepSize:   { type: 'number', minimum: 1 },
  },
} as const

const AoiRefSchema = {
  oneOf: [
    {
      type: 'object',
      required: ['by', 'name'],
      additionalProperties: false,
      properties: { by: { const: 'name' }, name: { type: 'string' } },
    },
    {
      type: 'object',
      required: ['by', 'slot'],
      additionalProperties: false,
      properties: { by: { const: 'slot' }, slot: { type: 'integer', minimum: 0 } },
    },
  ],
} as const

/** Leaf projections. Every variant carries a `kind` discriminator. */
export const LeafProjectionSchema = {
  oneOf: [
    { type: 'object', required: ['kind'], additionalProperties: false,
      properties: { kind: { const: 'identity-scalar' } } },
    { type: 'object', required: ['kind'], additionalProperties: false,
      properties: { kind: { const: 'identity-aoi-vector' } } },
    { type: 'object', required: ['kind'], additionalProperties: false,
      properties: { kind: { const: 'identity-aoi-pair-matrix' } } },

    { type: 'object', required: ['kind', 'aoiRef'], additionalProperties: false,
      properties: { kind: { const: 'pick-aoi' }, aoiRef: AoiRefSchema } },
    { type: 'object', required: ['kind'], additionalProperties: false,
      properties: { kind: { const: 'pick-any-fixation' } } },
    { type: 'object', required: ['kind', 'reducer'], additionalProperties: false,
      properties: {
        kind:    { const: 'aggregate-aoi' },
        reducer: { enum: [...AOI_REDUCERS] },
      } },

    { type: 'object', required: ['kind'], additionalProperties: false,
      properties: { kind: { const: 'matrix-diagonal' } } },
    { type: 'object', required: ['kind', 'aoiRef'], additionalProperties: false,
      properties: { kind: { const: 'matrix-row' }, aoiRef: AoiRefSchema } },
    { type: 'object', required: ['kind', 'aoiRef'], additionalProperties: false,
      properties: { kind: { const: 'matrix-col' }, aoiRef: AoiRefSchema } },
    { type: 'object', required: ['kind', 'fromAoi', 'toAoi'], additionalProperties: false,
      properties: {
        kind: { const: 'matrix-cell' },
        fromAoi: AoiRefSchema,
        toAoi:   AoiRefSchema,
      } },
    { type: 'object', required: ['kind', 'reducer'], additionalProperties: false,
      properties: {
        kind:    { const: 'matrix-aggregate' },
        reducer: { enum: [...MATRIX_REDUCERS] },
        exclude: { enum: ['diagonal'] },
      } },
  ],
} as const

/**
 * Projection = leaf | windowed wrapper. The wrapper's `inner` must itself be
 * a leaf whose effective shape is scalar (enforced at apply time).
 */
export const ProjectionSchema = {
  oneOf: [
    LeafProjectionSchema,
    {
      type: 'object',
      required: ['kind', 'window', 'inner'],
      additionalProperties: false,
      properties: {
        kind:   { const: 'windowed' },
        window: WindowSpecSchema,
        inner:  LeafProjectionSchema,
      },
    },
  ],
} as const

export { WindowSpecSchema }
