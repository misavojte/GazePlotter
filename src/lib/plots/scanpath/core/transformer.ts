import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type {
  ScanpathData,
  ScanpathFixation,
  ScanpathPlotSettings,
  ScanpathTransformResult,
} from '../types'
import { FIXATION_CATEGORY_ID } from '$lib/data/binary'

/**
 * Collects a single participant's fixation sequence on a stimulus.
 *
 * A segment counts as a fixation when its category equals `FIXATION_CATEGORY_ID`
 * (see `$lib/data/binary`); saccades, blinks, and unclassified segments are
 * skipped. Each fixation contributes one point at its recorded spatial
 * coordinate; segments with missing spatial data are excluded from the
 * rendered set (and therefore from the 1..N rank as well).
 */
export function getScanpathData(
  engine: DataEngine,
  settings: ScanpathPlotSettings
): ScanpathTransformResult {
  const reader = engine.getReader()
  if (!reader) return { kind: 'unavailable', reason: 'no-fixations' }
  if (!reader.hasSpatialData) {
    return { kind: 'unavailable', reason: 'no-spatial-data' }
  }

  const { startIndex, endIndex } = reader.getSegmentRange(
    settings.stimulusId,
    settings.participantId
  )

  let anyFixation = false
  const fixations: ScanpathFixation[] = []

  for (let i = startIndex; i < endIndex; i++) {
    if (reader.getSegmentCategory(i) !== FIXATION_CATEGORY_ID) continue
    anyFixation = true

    const spatial = reader.getSegmentSpatial(i)
    if (!spatial) continue
    if (!Number.isFinite(spatial.x) || !Number.isFinite(spatial.y)) continue

    const duration = reader.getSegmentEnd(i) - reader.getSegmentStart(i)
    fixations.push({
      rank: fixations.length + 1,
      x: spatial.x,
      y: spatial.y,
      duration,
    })
  }

  if (fixations.length === 0) {
    return {
      kind: 'unavailable',
      reason: anyFixation ? 'no-spatial-coords' : 'no-fixations',
    }
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let minDuration = Infinity
  let maxDuration = 0
  for (const f of fixations) {
    if (f.x < minX) minX = f.x
    if (f.x > maxX) maxX = f.x
    if (f.y < minY) minY = f.y
    if (f.y > maxY) maxY = f.y
    if (f.duration < minDuration) minDuration = f.duration
    if (f.duration > maxDuration) maxDuration = f.duration
  }

  const data: ScanpathData = {
    fixations,
    bbox: { minX, maxX, minY, maxY },
    minDuration,
    maxDuration,
  }
  return { kind: 'ok', data }
}
