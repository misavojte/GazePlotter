import { describe, expect, it } from 'vitest'
import { plotRegistry } from '$lib/plots/registry'
import { SHARED_SECTIONS } from '$lib/plots/shared/components/sections'

/**
 * Guards against drift between each plot's declarative `paneSections` and the
 * cross-type-shared section registry that the multi-select Pane intersects.
 */
describe('paneSections / SHARED_SECTIONS consistency', () => {
  const defs = Object.values(plotRegistry) as Array<{
    type: string
    paneSections: { key: string; component: unknown }[]
  }>

  it('every plot declares a non-empty paneSections including the universal sections', () => {
    for (const def of defs) {
      const keys = def.paneSections.map(e => e.key)
      expect(keys.length).toBeGreaterThan(0)
      // stimulus is universal; AOI is common to all plots except scanpath.
      expect(keys).toContain('stimulus')
      if (def.type !== 'scanpath') {
        expect(keys).toContain('aoi')
      }
    }
  })

  it('every section entry has a string key and a component', () => {
    for (const def of defs) {
      for (const entry of def.paneSections) {
        expect(typeof entry.key).toBe('string')
        expect(entry.component).toBeTruthy()
      }
    }
  })

  it('every SHARED_SECTIONS key is used by at least one plot (no orphan shared section)', () => {
    const used = new Set(defs.flatMap(d => d.paneSections.map(e => e.key)))
    for (const key of Object.keys(SHARED_SECTIONS)) {
      expect(used.has(key)).toBe(true)
    }
  })

  it('bare (non-namespaced) section keys resolve in SHARED_SECTIONS, except the type-specific metric', () => {
    // A mixed-type bulk renders common shared sections canonically from
    // SHARED_SECTIONS; any bare key a plot uses must therefore be registered
    // (metric is intentionally type-specific and excluded from the registry).
    for (const def of defs) {
      for (const { key } of def.paneSections) {
        if (key.includes(':') || key === 'metric') continue
        expect(key in SHARED_SECTIONS).toBe(true)
      }
    }
  })
})
