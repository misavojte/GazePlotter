import { describe, expect, it } from 'vitest'
import { ensureSettingsSchemasValid, plotRegistry } from '$lib/plots/registry'
import { SHARED_SECTIONS } from '$lib/plots/shared/components/sections'
import type { PaneSectionEntry } from '$lib/plots/definePlot'

/**
 * Guards against drift between each plot's declarative `paneSections` and the
 * cross-type-shared section registry that the multi-select Pane intersects.
 */
describe('paneSections / SHARED_SECTIONS consistency', () => {
  const defs = Object.values(plotRegistry) as Array<{
    type: string
    paneSections: PaneSectionEntry[]
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

  it('every section entry has a string key and a component or a schema field list', () => {
    for (const def of defs) {
      for (const entry of def.paneSections) {
        expect(typeof entry.key).toBe('string')
        if ('fields' in entry) {
          // Schema shape: a title and at least one field. Field-level validity
          // (unique keys, defaults, options) is enforced on first registry use
          // by `assertSettingsSchema` — run it here so a violation fails THIS
          // pin, not some downstream plot lookup.
          expect(() => ensureSettingsSchemasValid()).not.toThrow()
          expect(typeof entry.title).toBe('string')
          expect(entry.fields.length).toBeGreaterThan(0)
        } else {
          expect(entry.component).toBeTruthy()
        }
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
