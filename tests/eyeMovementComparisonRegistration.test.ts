/**
 * Registry smoke for the eye-movement comparison plot. Lives in its own file
 * so registry.ts initializes FIRST, the same order production uses; a test
 * that imports a plot subpath before the registry would freeze a
 * partially-initialized registry entry instead.
 */
import { describe, it, expect } from 'vitest'
import { plotRegistry } from '../src/lib/plots/registry'

describe('eye-movement comparison registration', () => {
  it('is registered with valid defaults', () => {
    const def = plotRegistry.eyeMovementComparison
    expect(def.name).toBe('Eye-movement Comparison')
    expect(def.group).toBe('gaze-behavior')
    const defaults = def.getDefaultSettings()
    // The library flow: default instance is the seeded movementDuration
    // starter (per-type counts are near-degenerate — saccades interleave
    // fixations — so the duration vector is the informative first view).
    expect(defaults.metricInstanceIds).toEqual(['movementDuration'])
    expect(defaults.orderBy).toBe('type')
    expect(defaults.statisticalOverlay).toBe('meanCi95')
    expect(def.consumesMetrics?.outputShape).toBe('category-vector')
  })
})
