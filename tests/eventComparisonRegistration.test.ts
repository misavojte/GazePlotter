/**
 * Registry smoke for the event comparison plot. Lives in its own file so
 * registry.ts initializes FIRST, the same order production uses; a test that
 * imports a plot subpath before the registry would freeze a
 * partially-initialized registry entry instead.
 */
import { describe, it, expect } from 'vitest'
import { plotRegistry } from '../src/lib/plots/registry'

describe('event comparison registration', () => {
  it('is registered with valid defaults', () => {
    const def = plotRegistry.eventComparison
    expect(def.name).toBe('Event Comparison')
    expect(def.group).toBe('per-event')
    const defaults = def.getDefaultSettings()
    // The library flow: default instance is the seeded eventDuration starter.
    expect(defaults.metricInstanceIds).toEqual(['eventDuration'])
    expect(defaults.orderBy).toBe('channel')
    expect(defaults.statisticalOverlay).toBe('meanCi95')
    expect(def.consumesMetrics?.outputShape).toBe('event-vector')
    // No axis without event data — and no segment dependency, so event-only
    // datasets (segmented: false) still get the plot.
    expect(def.requireCapabilities).toEqual(['event'])
  })
})
