import { describe, expect, it } from 'vitest'
import {
  getPlotDisplayName,
  resolvePlotDefinition,
} from '$lib/plots/registry'

describe('plotRegistry helpers', () => {
  it('resolves registered plot definitions', () => {
    const result = resolvePlotDefinition('scarf')

    expect(result.name).toBeTruthy()
    expect(result.view.deriveView).toBeTypeOf('function')
  })

  it('supports legacy visualization type aliases', () => {
    const result = resolvePlotDefinition('TransitionMatrix')

    expect(result.name).toBe('Transition Matrix')
  })

  // The AOI Comparison was registered under its mark ('barPlot') until it was
  // renamed to its identity. Every saved workspace still carries the old key,
  // so the alias is load-bearing, not cosmetic.
  it('resolves the retired mark-named key for the AOI Comparison', () => {
    expect(resolvePlotDefinition('barPlot').name).toBe('AOI Comparison')
    expect(getPlotDisplayName('barPlot')).toBe('AOI Comparison')
    expect(getPlotDisplayName('aoiComparison')).toBe('AOI Comparison')
  })

  // Metric Timeline's screen recipe exists ONLY to build its TIME CURSOR port,
  // and `screen` is optional in the contract — dropping the line is type-legal
  // and leaves the plot silently cursor-less.
  it('registers the screen recipe that gives the Metric Timeline its time cursor', () => {
    expect(resolvePlotDefinition('evolvingMetrics').screen).toBeTypeOf('function')
  })

  it('falls back to the raw plot type label and throws for unknown plot types', () => {
    expect(getPlotDisplayName('missing-plot')).toBe('missing-plot')
    expect(() => resolvePlotDefinition('missing-plot')).toThrow(
      'Plot type "missing-plot" is not registered.'
    )
  })
})
