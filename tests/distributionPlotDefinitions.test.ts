import { describe, it, expect } from 'vitest'
import { plotRegistry } from '../src/lib/plots/registry'
import type { BeeswarmInput } from '../src/lib/plots/shared/distribution/beeswarm/kit'
import type { DistributionView } from '../src/lib/plots/shared/distribution/figure'
import { createAdaptiveTimeline } from '../src/lib/plots/shared/timelineUtils'

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
    expect(plotRegistry.aoiComparison.sync?.map(s => s.channel)).toEqual(['distribution-value-axis'])
    expect('sync' in plotRegistry.eyeMovementComparison).toBe(false)
    expect('sync' in plotRegistry.eventComparison).toBe(false)
  })

  it('offers the data max per type, metric and size, unless the range is user-set', () => {
    const [sync] = plotRegistry.aoiComparison.sync!
    const settings = plotRegistry.aoiComparison.getDefaultSettings()
    const view: DistributionView = {
      kit: {} as never,
      input: { timeline: createAdaptiveTimeline(0, 40, 6) } as BeeswarmInput,
      meta: { syncKey: 'absoluteTime', dataMax: 40 },
    }
    const item = { type: 'aoiComparison', w: 12, h: 10 }
    const offer = (over: Partial<typeof settings>, v: DistributionView | null = view) =>
      sync.offer({ settings: { ...settings, ...over }, view: v, item, engine: {} as never })
    expect(offer({})).toEqual({ key: ['aoiComparison', 'absoluteTime', 12, 10], own: 40 })
    expect(offer({ scaleRange: [0, 100] })).toBeNull()
    expect(offer({}, { ...view, meta: { syncKey: null, dataMax: 40 } })).toBeNull()
    expect(offer({}, null)).toBeNull()
    expect(sync.input!(view, 90).timeline?.maxValue).toBe(createAdaptiveTimeline(0, 90, 6).maxValue)
  })
})
