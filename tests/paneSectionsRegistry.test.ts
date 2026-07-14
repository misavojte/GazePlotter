import { describe, expect, it } from 'vitest'
import { ensureSettingsSchemasValid, plotRegistry } from '$lib/plots/registry'
import {
  SHARED_SECTIONS,
  crossTypeSectionKeys,
} from '$lib/plots/shared/components/sections'
import { paneSectionKey, type PaneSectionEntry } from '$lib/plots/definePlot'

/**
 * Guards against drift between each plot's declarative `paneSections` and the
 * shared-section registry. Entries are DATA ONLY: a shared-section key
 * string, `{ key, props }` for a shared section with static overrides, or a
 * schema section — never a Svelte component.
 */
describe('paneSections / SHARED_SECTIONS consistency', () => {
  const defs = Object.values(plotRegistry) as Array<{
    type: string
    paneSections: PaneSectionEntry[]
    getDefaultSettings: () => Record<string, unknown>
  }>

  it('every plot declares a non-empty paneSections including the universal sections', () => {
    // The Metric Matrix spans EVERY stimulus (it has no per-plot stimulusId), so
    // it carries neither the 'stimulus' section nor 'aoi' (the AOI info-section's
    // modal keys off a stimulusId it doesn't have). It is the sole exception to
    // the otherwise-universal 'stimulus', alongside scanpath for 'aoi'.
    const STIMULUS_SPANNING = new Set(['metricMatrix'])
    for (const def of defs) {
      const keys = def.paneSections.map(paneSectionKey)
      expect(keys.length).toBeGreaterThan(0)
      if (!STIMULUS_SPANNING.has(def.type)) {
        expect(keys).toContain('stimulus')
      }
      if (def.type !== 'scanpath' && !STIMULUS_SPANNING.has(def.type)) {
        expect(keys).toContain('aoi')
      }
    }
  })

  it('every entry is a resolvable key, a keyed props object, or a schema section', () => {
    // Mirrors PaneSectionList's resolution exactly: bare keys and `{ key,
    // props }` entries both resolve through SHARED_SECTIONS, inline schemas
    // carry their own fields.
    for (const def of defs) {
      for (const entry of def.paneSections) {
        if (typeof entry === 'string') {
          expect(entry in SHARED_SECTIONS).toBe(true)
        } else if ('fields' in entry) {
          // Schema shape: a title and at least one field. Field-level validity
          // (unique keys, defaults, options) is enforced on first registry use
          // by `assertSettingsSchema` — run it here so a violation fails THIS
          // pin, not some downstream plot lookup.
          expect(() => ensureSettingsSchemasValid()).not.toThrow()
          expect(typeof entry.title).toBe('string')
          expect(entry.fields.length).toBeGreaterThan(0)
        } else {
          expect(entry.key in SHARED_SECTIONS).toBe(true)
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

  it('bare (non-namespaced) section keys resolve in the shared registry', () => {
    // A mixed-type bulk renders common shared sections canonically from
    // SHARED_SECTIONS; any bare key a plot uses must therefore resolve.
    for (const def of defs) {
      for (const entry of def.paneSections) {
        const key = paneSectionKey(entry)
        if (key.includes(':')) continue
        expect(key in SHARED_SECTIONS).toBe(true)
      }
    }
  })

  it('shared schema fields are backed by every referencing plot\'s defaults', () => {
    // `assertSettingsSchema` only sees a definition's INLINE schema sections;
    // shared schemas referenced by bare key must hold the same invariant
    // against each referencing plot's defaults.
    for (const def of defs) {
      const defaults = def.getDefaultSettings()
      for (const entry of def.paneSections) {
        const key = paneSectionKey(entry)
        if (typeof entry !== 'string' && 'fields' in entry) continue
        const shared = SHARED_SECTIONS[key]
        if (!shared || !('fields' in shared)) continue
        for (const field of shared.fields) {
          if (field.kind === 'info') continue
          const hasDefault =
            field.kind === 'colorScale' ||
            ('default' in field && field.default !== undefined)
          expect(
            field.key in defaults || hasDefault,
            `${def.type}: shared section "${key}" field "${field.key}"`
          ).toBe(true)
        }
      }
    }
  })

  it('crossTypeSectionKeys gates metric on identical contracts', () => {
    // Same type: trivially compatible.
    expect(crossTypeSectionKeys(['barPlot', 'barPlot']).has('metric')).toBe(true)
    // scarf consumes no metrics: a mixed bulk with it must not offer metric.
    expect(crossTypeSectionKeys(['barPlot', 'scarf']).has('metric')).toBe(false)
    // Every other shared key survives the gate untouched.
    expect(crossTypeSectionKeys(['barPlot', 'scarf']).has('stimulus')).toBe(true)
  })
})
