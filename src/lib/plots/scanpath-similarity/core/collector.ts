import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import type { ExtendedInterpretedDataType } from '$lib/data/types'

/**
 * Extract scanpath string for a single participant on a stimulus.
 * Each fixation's primary AOI is mapped to a letter (A, B, C...).
 * '#' represents fixations outside any AOI.
 */
export function collectScanpath(
  engine: DataEngine,
  stimulusId: number,
  participantId: number,
  aois: ExtendedInterpretedDataType[],
  collapsed: boolean
): string {
  const reader = engine.getReader()
  const meta = engine.metadata
  if (!reader || !meta) return ''

  const aoiGroupReader = engine.getAoiGroupReader()
  if (!aoiGroupReader) return ''

  const hiddenAois = meta.aois.hiddenAois?.[stimulusId] ?? []
  const hiddenSet = hiddenAois.length ? new Set(hiddenAois) : null

  // Build AOI ID -> index lookup
  const aoiLookup = new Map<number, number>()
  for (let i = 0; i < aois.length; i++) {
    aoiLookup.set(aois[i].id, i)
  }

  const aoiBuffer = new Uint16Array(32)
  let result = ''
  let prevChar = ''

  const { startIndex, endIndex } = reader.getSegmentRange(
    stimulusId,
    participantId
  )

  for (let segIdx = startIndex; segIdx < endIndex; segIdx++) {
    if (reader.getSegmentCategory(segIdx) !== 0) continue

    const aoiCount = aoiGroupReader.getSegmentAoisIntoUniqueTyped(
      segIdx,
      stimulusId,
      aoiBuffer
    )

    let ch: string
    if (aoiCount === 0) {
      ch = '#'
    } else {
      // Find first visible mapped AOI
      let foundIdx = -1
      for (let a = 0; a < aoiCount; a++) {
        const rawId = aoiBuffer[a]
        if (hiddenSet?.has(rawId)) continue
        const mappedId = engine.getAoiMapping(stimulusId, rawId)
        const idx = aoiLookup.get(mappedId)
        if (idx !== undefined) {
          foundIdx = idx
          break
        }
      }
      ch = foundIdx >= 0 ? String.fromCharCode(65 + foundIdx) : '#'
    }

    if (collapsed && ch === prevChar) continue
    result += ch
    prevChar = ch
  }

  return result
}

/**
 * Collect scanpaths for all given participants.
 * Returns an array of { participantId, label, scanpath } objects.
 */
export function collectAllScanpaths(
  engine: DataEngine,
  stimulusId: number,
  participantIds: number[],
  aois: ExtendedInterpretedDataType[],
  collapsed: boolean
): { participantId: number; label: string; scanpath: string }[] {
  const meta = engine.metadata
  if (!meta) return []

  return participantIds.map(pid => ({
    participantId: pid,
    label: meta.participants.data[pid]?.[1] ?? meta.participants.data[pid]?.[0] ?? `P${pid}`,
    scanpath: collectScanpath(engine, stimulusId, pid, aois, collapsed),
  }))
}
