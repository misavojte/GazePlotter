import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { ExtendedInterpretedDataType } from '$lib/data/types'
import { FIXATION_CATEGORY_ID } from '$lib/data/binary'

/**
 * Encode one participant's fixation sequence as an AOI-letter scanpath.
 * Each fixation's primary AOI is mapped to a letter (A, B, C…); fixations
 * outside any visible AOI become '#'. With `collapsed=true`, consecutive
 * identical characters are folded so that "AABBC" becomes "ABC".
 *
 * Time window: a fixation is encoded when its onset falls in
 * `[timeStart, timeEnd)`. `timeEnd <= 0` means "unbounded above";
 * `timeStart <= 0` means "unbounded below".
 */
export function collectScanpath(
  engine: DataEngine,
  stimulusId: number,
  participantId: number,
  aois: readonly ExtendedInterpretedDataType[],
  collapsed: boolean,
  timeStart: number = 0,
  timeEnd: number = 0,
): string {
  const reader = engine.getReader()
  const meta = engine.metadata
  if (!reader || !meta) return ''

  const aoiGroupReader = engine.getAoiGroupReader()
  if (!aoiGroupReader) return ''

  const hiddenAois = meta.aois.hiddenAois?.[stimulusId] ?? []
  const hiddenSet = hiddenAois.length ? new Set(hiddenAois) : null

  const aoiLookup = new Map<number, number>()
  for (let i = 0; i < aois.length; i++) {
    aoiLookup.set(aois[i].id, i)
  }

  const aoiBuffer = new Uint16Array(32)
  let result = ''
  let prevChar = ''
  const hasUpperBound = timeEnd > 0

  const { startIndex, endIndex } = reader.getSegmentRange(
    stimulusId,
    participantId
  )

  for (let segIdx = startIndex; segIdx < endIndex; segIdx++) {
    if (reader.getSegmentCategory(segIdx) !== FIXATION_CATEGORY_ID) continue

    const segStart = reader.getSegmentStart(segIdx)
    if (segStart < timeStart) continue
    if (hasUpperBound && segStart >= timeEnd) break

    const aoiCount = aoiGroupReader.getSegmentAoisUniqueDirect(
      segIdx,
      stimulusId,
      aoiBuffer
    )

    let ch: string
    if (aoiCount === 0) {
      ch = '#'
    } else {
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

/** Collect AOI-letter scanpaths for all given participants in their input order. */
export function collectAllScanpaths(
  engine: DataEngine,
  stimulusId: number,
  participantIds: readonly number[],
  aois: readonly ExtendedInterpretedDataType[],
  collapsed: boolean,
  timeStart: number = 0,
  timeEnd: number = 0,
): { participantId: number; label: string; scanpath: string }[] {
  const meta = engine.metadata
  if (!meta) return []

  return participantIds.map(pid => ({
    participantId: pid,
    label: meta.participants.data[pid]?.[1] ?? meta.participants.data[pid]?.[0] ?? `P${pid}`,
    scanpath: collectScanpath(engine, stimulusId, pid, aois, collapsed, timeStart, timeEnd),
  }))
}
