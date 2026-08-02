import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { ExtendedInterpretedDataType } from '$lib/data/types'
import { FIXATION_CATEGORY_ID } from '$lib/data/binary'

/**
 * Encode one participant's fixation sequence as an AOI-letter scanpath.
 * Each fixation's primary AOI is mapped to a letter (A, B, C…); fixations
 * outside any visible AOI become '#'. With `collapsed=true`, consecutive
 * identical characters are folded so that "AABBC" becomes "ABC".
 *
 * NOTE: "primary AOI = first visible in buffer order" is ONE of three
 * deliberately different multi-AOI policies — RQA drops multi-AOI fixations
 * entirely (`fixations.extractFixationSequence`), and the recurrence PLOT
 * keeps all AOIs (`plots/recurrence/core/collector`). Do not unify them.
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
  return encodeScanpath(
    engine,
    stimulusId,
    participantId,
    aoiLetterIndex(aois),
    collapsed,
    timeStart,
    timeEnd,
  )
}

/** AOI id → letter index. Depends only on `aois`, so a multi-participant run
 *  builds it once rather than per participant (see {@link collectAllScanpaths}). */
function aoiLetterIndex(
  aois: readonly ExtendedInterpretedDataType[],
): Map<number, number> {
  const lookup = new Map<number, number>()
  for (let i = 0; i < aois.length; i++) lookup.set(aois[i].id, i)
  return lookup
}

/** The encoder proper; {@link collectScanpath} documents the policy it implements. */
function encodeScanpath(
  engine: DataEngine,
  stimulusId: number,
  participantId: number,
  aoiLookup: ReadonlyMap<number, number>,
  collapsed: boolean,
  timeStart: number,
  timeEnd: number,
): string {
  const reader = engine.getReader()
  if (!reader || !engine.metadata) return ''

  const aoiGroupReader = engine.getAoiGroupReader()
  if (!aoiGroupReader) return ''

  // Unique mapped AOIs per segment. The reader writes without bounds-checking,
  // so a segment overlapped by more DISTINCT AOI groups than this would
  // silently lose the excess. Deliberately NOT sized from `aoiLookup`: under an
  // AOI SELECTION that map is narrowed, while the reader still resolves against
  // every group in the stimulus, so its size is a lower bound, not an upper one.
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

    // Already group-mapped and deduplicated: the reader resolves each raw id
    // through `groupPool`, which is what `getAoiMapping` does. Do not map
    // again here.
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
        const idx = aoiLookup.get(aoiBuffer[a])
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

  const aoiLookup = aoiLetterIndex(aois)
  return participantIds.map(pid => ({
    participantId: pid,
    label: meta.participants.data[pid]?.[1] ?? meta.participants.data[pid]?.[0] ?? `P${pid}`,
    scanpath: encodeScanpath(engine, stimulusId, pid, aoiLookup, collapsed, timeStart, timeEnd),
  }))
}
