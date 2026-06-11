/**
 * Legacy AOI-visibility event files (Tobii XML / Tobii JSON) — the
 * 'interactive' enrichment format. These files carry no stimulus or
 * participant names of their own, so consumption requires the mapping
 * modal against a loaded dataset; only DETECTION lives here. The
 * interactive flow stays in the ingest service (main thread).
 */

import type { EnrichmentFormatDefinition } from '../kernel/format'

/**
 * Shape sniff mirroring `isTobiiJson` (aoiVisibilityServices): an `Aois`
 * object whose first entry carries `KeyFrames`. Runs on the probe slice
 * (≤256 KB) — real AOI-visibility exports are far smaller.
 */
function looksLikeTobiiAoiJson(slice: string): boolean {
  let parsed: unknown
  try {
    parsed = JSON.parse(slice)
  } catch {
    return false
  }
  if (typeof parsed !== 'object' || parsed === null) return false
  if (!('Aois' in parsed)) return false
  const aois = (parsed as Record<string, unknown>)['Aois']
  if (typeof aois !== 'object' || aois === null) return false
  const keys = Object.keys(aois as Record<string, unknown>)
  if (keys.length === 0) return false
  const first = (aois as Record<string, unknown>)[keys[0]]
  if (typeof first !== 'object' || first === null) return false
  return 'KeyFrames' in first
}

export const legacyEventsFormat: EnrichmentFormatDefinition = {
  kind: 'enrichment',
  id: 'legacy-aoi-events',
  displayName: 'AOI visibility events (XML/JSON)',
  consume: 'interactive',
  detect: probe => {
    const name = probe.fileName.toLowerCase()
    if (name.endsWith('.xml')) return true
    if (name.endsWith('.json')) return looksLikeTobiiAoiJson(probe.slice)
    return false
  },
}
