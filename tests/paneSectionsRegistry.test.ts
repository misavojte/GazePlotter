import { describe, expect, it } from 'vitest'
import { ensureSettingsSchemasValid, plotRegistry } from '$lib/plots/registry'
import {
  PANE_SECTION_COMPONENTS,
  SHARED_SECTIONS,
} from '$lib/plots/shared/components/sections'
import { paneSectionKey, type PaneSectionEntry } from '$lib/plots/definePlot'

/**
 * Guards against drift between each plot's declarative `paneSections` and the
 * shared-section registries. Entries are DATA ONLY: a shared-section key
 * string, `{ key, props }` for a shared section with static props, or a
 * schema section — never a Svelte component.
 */
describe('paneSections / SHARED_SECTIONS consistency', () => {
  const defs = Object.values(plotRegistry) as Array<{
    type: string
    paneSections: PaneSectionEntry[]
  }>

  it('every plot declares a non-empty paneSections including the universal sections', () => {
    for (const def of defs) {
      const keys = def.paneSections.map(paneSectionKey)
      expect(keys.length).toBeGreaterThan(0)
      // stimulus is universal; AOI is common to all plots except scanpath.
      expect(keys).toContain('stimulus')
      if (def.type !== 'scanpath') {
        expect(keys).toContain('aoi')
      }
    }
  })

  it('every entry is a resolvable key, a keyed props object, or a schema section', () => {
    for (const def of defs) {
      for (const entry of def.paneSections) {
        if (typeof entry === 'string') {
          expect(entry in PANE_SECTION_COMPONENTS).toBe(true)
        } else if ('fields' in entry) {
          // Schema shape: a title and at least one field. Field-level validity
          // (unique keys, defaults, options) is enforced on first registry use
          // by `assertSettingsSchema` — run it here so a violation fails THIS
          // pin, not some downstream plot lookup.
          expect(() => ensureSettingsSchemasValid()).not.toThrow()
          expect(typeof entry.title).toBe('string')
          expect(entry.fields.length).toBeGreaterThan(0)
        } else {
          expect(entry.key in PANE_SECTION_COMPONENTS).toBe(true)
          expect(typeof entry.props).toBe('object')
        }
      }
    }
  })

  it('every SHARED_SECTIONS key is used by at least one plot (no orphan shared section)', () => {
    const used = new Set(defs.flatMap(d => d.paneSections.map(paneSectionKey)))
    for (const key of Object.keys(SHARED_SECTIONS)) {
      expect(used.has(key)).toBe(true)
    }
  })

  it('bare (non-namespaced) section keys resolve in the component registry', () => {
    // A mixed-type bulk renders common shared sections canonically from
    // SHARED_SECTIONS; any bare key a plot uses must therefore resolve
    // (metric resolves for single/same-type panes but is intentionally
    // excluded from the cross-type SHARED_SECTIONS subset).
    for (const def of defs) {
      for (const entry of def.paneSections) {
        const key = paneSectionKey(entry)
        if (key.includes(':')) continue
        expect(key in PANE_SECTION_COMPONENTS).toBe(true)
      }
    }
  })
})
