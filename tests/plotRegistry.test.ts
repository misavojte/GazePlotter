import { describe, expect, it } from 'vitest'
import {
  getPlotDisplayName,
  resolvePlotDefinition,
} from '$lib/plots/registry'

describe('plotRegistry helpers', () => {
  it('resolves registered plot definitions', () => {
    const result = resolvePlotDefinition('scarf')

    expect(result.name).toBeTruthy()
    expect(result.component).toBeTruthy()
  })

  it('supports legacy visualization type aliases', () => {
    const result = resolvePlotDefinition('TransitionMatrix')

    expect(result.name).toBe('Transition Matrix')
  })

  it('falls back to the raw plot type label and throws for unknown plot types', () => {
    expect(getPlotDisplayName('missing-plot')).toBe('missing-plot')
    expect(() => resolvePlotDefinition('missing-plot')).toThrow(
      'Plot type "missing-plot" is not registered.'
    )
  })
})
