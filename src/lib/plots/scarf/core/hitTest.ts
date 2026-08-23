import {
  SEGMENT_STRIDE,
  SegmentField,
  FIXATION_CATEGORY_ID,
} from '$lib/data/binary/schema'
import type { ScarfGazeSource } from '../types'

export interface GazeSegmentHit {
  /** Clipped segment x, normalized [0,1] within the plot area */
  x: number
  /** Clipped segment width, normalized [0,1] */
  width: number
  /** Per-participant segment index (the tooltip key) */
  orderId: number
  /** Resolved style index; a multi-AOI fixation resolves to its topmost slice */
  styleIdx: number
}

/**
 * Find the gaze segment under a normalized x in one participant row, resolving
 * AOI/category visibility inline. Segments in a row are time-disjoint, so at
 * most one contains x. KEEP IN SYNC with compositeGazeBinaryAcc +
 * drawHighlightMarkersFromBinary (renderer.ts), which walk the same buffer;
 * tests/scarfHoverRenderParity.test.ts pins hover against the composite.
 */
export function findGazeSegmentAt(
  gs: ScarfGazeSource,
  rowIndex: number,
  xNorm: number
): GazeSegmentHit | null {
  if (rowIndex < 0 || rowIndex >= gs.participantIds.length) return null
  const segBuf = gs.reader.segmentBufferRaw
  const clipMin = gs.projClipMin[rowIndex]
  const clipMax = gs.projClipMax[rowIndex]
  const pScale = gs.projScale[rowIndex]
  const pid = gs.participantIds[rowIndex]
  const { startIndex, endIndex } = gs.reader.getSegmentRange(gs.stimulusId, pid)

  let hit: GazeSegmentHit | null = null
  for (let i = startIndex; i < endIndex; i++) {
    const localId = i - startIndex
    const segBase = i * SEGMENT_STRIDE
    const categoryId = segBuf[segBase + SegmentField.CATEGORY_ID] | 0
    let start = gs.isOrdinal ? localId : segBuf[segBase + SegmentField.START_TIME]
    let end = gs.isOrdinal ? localId + 1 : segBuf[segBase + SegmentField.END_TIME]
    if (end <= clipMin) continue
    // Time-ordered per participant: nothing later can intersect the clip.
    if (start >= clipMax) break
    start = Math.max(clipMin, start)
    end = Math.min(clipMax, end)
    const xN = (start - clipMin) * pScale
    const wN = (end - start) * pScale
    if (xNorm < xN || xNorm > xN + wN) continue

    if (categoryId !== FIXATION_CATEGORY_ID) {
      // -1 covers narrowed-away categories too: not drawn, so not hoverable.
      const sIdx =
        categoryId >= 0 && categoryId < gs.categoryStyleIdxMap.length
          ? gs.categoryStyleIdxMap[categoryId]
          : -1
      if (sIdx === -1) continue
      hit = { x: xN, width: wN, orderId: localId, styleIdx: sIdx }
    } else {
      // The transformer's precomputed VISIBLE slices (buildResolvedSlices),
      // the same data the composite and highlight painters read, so hover
      // identity always matches the rendered bands.
      const slot = gs.resolvedSlotBase[rowIndex] + localId
      const s0 = gs.resolvedSliceStart[slot]
      const resolved = gs.resolvedSliceStart[slot + 1] - s0
      if (resolved === 0) {
        if (gs.noAoiStyleIdx < 0) continue
        hit = { x: xN, width: wN, orderId: localId, styleIdx: gs.noAoiStyleIdx }
      } else {
        hit = {
          x: xN,
          width: wN,
          orderId: localId,
          // Topmost sub-rect wins = the LAST slice, same order the painters stack.
          styleIdx: gs.resolvedSliceStyles[s0 + resolved - 1],
        }
      }
    }
  }
  return hit
}
