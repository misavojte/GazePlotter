import { describe, expect, it } from 'vitest'
import {
  getWorkspacePlotLabel,
  resolveWorkspacePlotDefinition,
} from '$lib/workspace/grid/plotResolver'
import type { AllGridTypes } from '$lib/workspace/type/gridType'

describe('plotResolver', () => {
  it('resolves registered plot definitions', () => {
    const item = { type: 'scarf' } as unknown as AllGridTypes

    const result = resolveWorkspacePlotDefinition(item)

    expect(result.name).toBeTruthy()
    expect(result.component).toBeTruthy()
  })

  it('falls back to the raw plot type label and throws for unknown plot types', () => {
    const item = { type: 'missing-plot' } as unknown as AllGridTypes

    expect(getWorkspacePlotLabel(item)).toBe('missing-plot')
    expect(() => resolveWorkspacePlotDefinition(item)).toThrow(
      'Plot type "missing-plot" is not registered.'
    )
  })
})
