/**
 * Hand-written JSON Schema for discriminated-union shapes not auto-derived
 * from TS types. Used by future WebMCP / LLM tool surfaces to validate
 * instance creation payloads without pulling a schema generator.
 */

export const WindowingConfigSchema = {
  type: 'object',
  required: ['mode', 'windowSize', 'reduction'],
  additionalProperties: false,
  properties: {
    mode: { enum: ['epoch', 'sliding'] },
    windowSize: { type: 'number', minimum: 1 },
    stepSize: { type: 'number', minimum: 1 },
    reduction: { enum: ['mean', 'max', 'min', 'final'] },
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

/**
 * Projection schema — two-axis discriminator. Every variant carries:
 *   - target: desired output shape (drives consumer context matching)
 *   - from:   method for deriving `target` from the recipe's raw shape
 * plus any method-specific parameters.
 */
export const ProjectionSchema = {
  oneOf: [
    // → scalar
    { type: 'object', required: ['target', 'from'], additionalProperties: false,
      properties: { target: { const: 'scalar' }, from: { const: 'identity' } } },
    { type: 'object', required: ['target', 'from', 'aoiRef'], additionalProperties: false,
      properties: { target: { const: 'scalar' }, from: { const: 'pick-aoi' }, aoiRef: AoiRefSchema } },
    { type: 'object', required: ['target', 'from', 'reducer'], additionalProperties: false,
      properties: {
        target: { const: 'scalar' }, from: { const: 'aggregate-aoi' },
        reducer: { enum: ['mean', 'sum', 'max', 'min', 'median'] },
      } },
    { type: 'object', required: ['target', 'from', 'reducer'], additionalProperties: false,
      properties: {
        target: { const: 'scalar' }, from: { const: 'matrix-aggregate' },
        reducer: { enum: ['mean', 'sum'] },
        exclude: { enum: ['diagonal'] },
      } },
    { type: 'object', required: ['target', 'from', 'fromAoi', 'toAoi'], additionalProperties: false,
      properties: {
        target: { const: 'scalar' }, from: { const: 'matrix-cell' },
        fromAoi: AoiRefSchema, toAoi: AoiRefSchema,
      } },
    // → aoi-vector
    { type: 'object', required: ['target', 'from'], additionalProperties: false,
      properties: { target: { const: 'aoi-vector' }, from: { const: 'identity' } } },
    { type: 'object', required: ['target', 'from'], additionalProperties: false,
      properties: { target: { const: 'aoi-vector' }, from: { const: 'matrix-diagonal' } } },
    { type: 'object', required: ['target', 'from', 'aoiRef'], additionalProperties: false,
      properties: { target: { const: 'aoi-vector' }, from: { const: 'matrix-row' }, aoiRef: AoiRefSchema } },
    { type: 'object', required: ['target', 'from', 'aoiRef'], additionalProperties: false,
      properties: { target: { const: 'aoi-vector' }, from: { const: 'matrix-col' }, aoiRef: AoiRefSchema } },
    // → aoi-pair-matrix
    { type: 'object', required: ['target', 'from'], additionalProperties: false,
      properties: { target: { const: 'aoi-pair-matrix' }, from: { const: 'identity' } } },
  ],
} as const
