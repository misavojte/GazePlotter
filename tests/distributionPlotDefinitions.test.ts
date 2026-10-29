import { describe, it, expect } from 'vitest'
import { plotRegistry } from '../src/lib/plots/registry'

// Loaded through the registry, the comparison definitions run inside its import
// cycle; a binding read before initialization would leave a definition broken.
describe('comparison plots defined by defineDistributionPlot', () => {
  const plots = [
    plotRegistry.aoiComparison,
    plotRegistry.eyeMovementComparison,
    plotRegistry.eventComparison,
  ]

  it('come out of the registry complete', () => {
    for (const def of plots) {
      expect(def.paneSections.map(s => (typeof s === 'string' ? s : s.key))).toContain(
        `${def.type}:visualization`
      )
      expect(typeof def.getSubtitle).toBe('function')
      expect(typeof def.view.deriveView).toBe('function')
      expect(typeof def.collect).toBe('function')
    }
  })

  it('default to their own category order and metric', () => {
    expect(plotRegistry.aoiComparison.getDefaultSettings()).toMatchObject({
      orderBy: 'aoi',
      metricInstanceIds: ['absoluteTime'],
      hideNoAoi: false,
    })
    expect(plotRegistry.eyeMovementComparison.getDefaultSettings().orderBy).toBe('type')
    expect(plotRegistry.eventComparison.getDefaultSettings().orderBy).toBe('channel')
  })

  it('sync the value axis only where opted in', () => {
    expect(plotRegistry.aoiComparison.screen).toBeTypeOf('function')
    expect('screen' in plotRegistry.eyeMovementComparison).toBe(false)
    expect('screen' in plotRegistry.eventComparison).toBe(false)
  })
})
