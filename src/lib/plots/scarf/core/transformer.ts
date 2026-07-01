/**
 * ScarfPlot Data Transformation Utilities
 */

import {
  getAois,
  getNumberOfSegments,
  getParticipantEndTime,
  hasEventsForStimulus,
  getVisibleEventChannels,
  getEventBuffer,
  getAllCategories,
  getHiddenCategories,
} from '$lib/data/engine'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { groupByDisplayedName } from '$lib/data/engine/utils/grouping'
import {
  FIXATION_CATEGORY_ID,
  type ExtendedInterpretedDataType,
} from '$lib/data/types'
import {
  createAdaptiveTimeline,
  type AdaptiveTimeline,
} from '$lib/plots/shared'
import {
  OVERLAY_EVENT_STRIDE,
  SCARF_IDENTIFIERS,
  SCARF_LAYOUT,
} from '../const'
import type {
  ScarfData,
  ScarfGazeSource,
  ScarfLegendData,
  ScarfLegendGroup,
  ScarfLegendItem,
  ScarfLegendStyleType,
  ScarfParticipant,
  ScarfPlotSettings,
  ScarfStyleItem,
  ScarfStyling,
  ScarfRectStyle,
  ScarfEventStyle,
} from '../types'
import type { LegendGroup } from '$lib/plots/shared'

class Float32GrowBuffer {
  private buffer: Float32Array
  private writeIndex: number

  constructor(initialCapacityFloats: number) {
    this.buffer = new Float32Array(initialCapacityFloats)
    this.writeIndex = 0
  }

  private ensureCapacity(additionalFloats: number) {
    const required = this.writeIndex + additionalFloats
    if (required <= this.buffer.length) return

    let newLength = this.buffer.length
    while (newLength < required) {
      newLength = Math.max(1024, newLength * 2)
    }

    const next = new Float32Array(newLength)
    next.set(this.buffer)
    this.buffer = next
  }

  /** Event overlay strip: [xNorm, pIndex, wNorm, laneIndex, isPoint]. */
  pushStrip(
    x: number,
    pIndex: number,
    width: number,
    laneIndex: number,
    isPoint: number
  ) {
    this.ensureCapacity(OVERLAY_EVENT_STRIDE)

    const idx = this.writeIndex
    const b = this.buffer

    b[idx] = x
    b[idx + 1] = pIndex
    b[idx + 2] = width
    b[idx + 3] = laneIndex
    b[idx + 4] = isPoint

    this.writeIndex += OVERLAY_EVENT_STRIDE
  }

  finalize(): Float32Array {
    return this.buffer.subarray(0, this.writeIndex)
  }
}

/**
 * Calculates the timeline range for the plot based on settings and participant data
 */
function calculateTimelineRange(
  engine: DataEngine,
  participantIds: number[],
  stimulusId: number,
  settings: ScarfPlotSettings
): { minValue: number; maxValue: number } {
  if (settings.timeline === 'relative') {
    return { minValue: 0, maxValue: 100 }
  }

  // Helper to calculate data max for fallback
  const getDataMax = (isOrdinalMode: boolean) => {
    let max = 0
    for (const pid of participantIds) {
      if (isOrdinalMode) {
        max = Math.max(max, getNumberOfSegments(engine, stimulusId, pid))
      } else {
        max = Math.max(max, getParticipantEndTime(engine, stimulusId, pid))
      }
    }
    return max
  }

  // 1. Try global settings first (new standard)
  if (settings.timeline === 'absolute') {
    const sStart = settings.timelineStart
    const sEnd = settings.timelineEnd
    const startVal = typeof sStart === 'number' && !isNaN(sStart) ? sStart : 0
    const endVal = typeof sEnd === 'number' && !isNaN(sEnd) ? sEnd : 0

    const hasStart = startVal > 0
    const hasEnd = endVal > 0

    if (hasStart || hasEnd) {
      const min = startVal
      const max = hasEnd ? endVal : getDataMax(false)

      // If user only provided start, ensure max is at least start + margin
      // If user provided end, we trust it (even if it clips data)
      return { minValue: min, maxValue: Math.max(min + 1, max) }
    }
  } else if (settings.timeline === 'ordinal') {
    const sStart = settings.ordinalStart
    const sEnd = settings.ordinalEnd
    const startVal = typeof sStart === 'number' && !isNaN(sStart) ? sStart : 0
    const endVal = typeof sEnd === 'number' && !isNaN(sEnd) ? sEnd : 0

    const hasStart = startVal > 0
    const hasEnd = endVal > 0

    if (hasStart || hasEnd) {
      const min = startVal
      const max = hasEnd ? endVal : getDataMax(true)

      return { minValue: min, maxValue: Math.max(min + 1, max) }
    }
  }

  // 2. Try stimulus-specific overrides from settings (legacy / specific override)
  const limits = (
    settings.timeline === 'absolute'
      ? settings.absoluteStimuliLimits
      : settings.ordinalStimuliLimits
  )?.[stimulusId]

  // Check if limits are defined and maxValue > 0.
  // If maxValue is 0, we treat it as 'auto' and fallback to data-driven range (e.g. after reset).
  if (Array.isArray(limits) && limits.length === 2 && limits[1] > 0) {
    return { minValue: Math.max(0, limits[0]), maxValue: limits[1] }
  }

  // 3. Fallback to data-driven range
  const isOrdinal = settings.timeline === 'ordinal'
  const maxValue = getDataMax(isOrdinal) // Reuse helper

  return {
    minValue: 0,
    maxValue: maxValue > 0 ? maxValue : isOrdinal ? 10 : 1000,
  }
}

/**
 * Creates the axis breaks for the scarf plot
 */
function createScarfPlotAxis(
  engine: DataEngine,
  participantIds: number[],
  stimulusId: number,
  settings: ScarfPlotSettings
): AdaptiveTimeline {
  const { minValue, maxValue } = calculateTimelineRange(
    engine,
    participantIds,
    stimulusId,
    settings
  )

  if (settings.timeline === 'relative') {
    return createAdaptiveTimeline(0, 100)
  } else if (settings.timeline === 'ordinal') {
    return createAdaptiveTimeline(
      minValue,
      maxValue,
      Math.min(10, maxValue - minValue)
    )
  } else {
    return createAdaptiveTimeline(minValue, maxValue)
  }
}

/**
 * Creates styling information for scarf plot segments.
 * Data-only: no sizing properties (heights computed in presentation layer).
 */
type GroupedCategory = ExtendedInterpretedDataType & {
  memberIds: number[]
}

export function groupCategoriesByDisplayedName(
  categories: ExtendedInterpretedDataType[]
): GroupedCategory[] {
  return groupByDisplayedName(categories)
}

/**
 * Creates styling information for scarf plot segments.
 * Data-only: no sizing properties (heights computed in presentation layer).
 */
function createStylingAndLegend(
  aoiData: readonly ExtendedInterpretedDataType[],
  noAoiTreatment: { displayedName: string; color: string },
  eventChannelData: readonly ExtendedInterpretedDataType[] = [],
  // Pre-grouped non-fixation categories (grouped ONCE by the caller and reused for
  // the style-index map), so this O(n^2) grouping + filter runs a single time.
  groupedCategories: readonly GroupedCategory[] = []
): ScarfStyling {
  const aoi: ScarfStyleItem[] = []
  for (let i = 0; i < aoiData.length; i++) {
    const a = aoiData[i]
    aoi.push({
      identifier: `${SCARF_IDENTIFIERS.AOI}${a.id}`,
      name: a.displayedName,
      color: a.color,
    })
  }
  aoi.push({
    identifier: `${SCARF_IDENTIFIERS.AOI}${SCARF_IDENTIFIERS.NOT_DEFINED}`,
    name: noAoiTreatment.displayedName,
    color: noAoiTreatment.color,
  })

  const category: ScarfStyleItem[] = []
  for (let i = 0; i < groupedCategories.length; i++) {
    const g = groupedCategories[i]
    category.push({
      identifier: `${SCARF_IDENTIFIERS.CATEGORY}${g.id}`,
      name: g.displayedName,
      color: g.color,
    })
  }

  const visibility: ScarfStyleItem[] = []
  for (let i = 0; i < eventChannelData.length; i++) {
    const ch = eventChannelData[i]
    visibility.push({
      identifier: `${SCARF_IDENTIFIERS.EVENT}${ch.id}`,
      name: ch.displayedName,
      color: ch.color,
    })
  }

  return { aoi, category, visibility }
}

type GroupedEventChannel = ExtendedInterpretedDataType & {
  memberIds: number[]
}

/**
 * Groups channels by trimmed displayed name while preserving first occurrence order.
 * Channels with empty displayed names stay as standalone entries.
 */
export function groupEventChannelsByDisplayedName(
  eventChannels: ExtendedInterpretedDataType[]
): GroupedEventChannel[] {
  return groupByDisplayedName(eventChannels)
}

/**
 * Creates group-aware legend data from styling information.
 */
function createScarfLegendData(
  styling: ScarfStyling,
  hideNonFixations = false,
  showEvents = false
): ScarfLegendData {
  const groups: ScarfLegendGroup[] = []

  const addGroup = (
    title: string,
    items: ScarfStyleItem[],
    styleType: ScarfLegendStyleType
  ) => {
    if (items.length === 0) return
    const legendItems: ScarfLegendItem[] = new Array(items.length)
    for (let i = 0; i < items.length; i++) {
      const { identifier, name, color } = items[i]
      legendItems[i] = { identifier, name, color, styleType }
    }
    groups.push({ title, items: legendItems })
  }

  addGroup('Fixations', styling.aoi, 'fixation')
  if (!hideNonFixations) {
    addGroup('Non-fixations', styling.category, 'nonFixation')
  }

  // Overlaid events render as solid colour strips, so the legend swatch is a
  // rectangle keyed by event type.
  if (showEvents) {
    addGroup('Event Channels', styling.visibility, 'fixation')
  }

  return { groups }
}

/**
 * One event for combined-mode lane packing.
 * `end === start` denotes a point (zero-duration) event.
 */
export interface OverlayEvent {
  start: number
  end: number
  /** event-type display order — tiebreak when starts are equal (lower → lower lane) */
  order: number
}

/**
 * Greedy lane packing for combined-mode events, SHARED across all event types.
 *
 * Sort by (start asc, type-order asc); assign each event the lowest lane whose
 * previous interval has already ended (laneEnd ≤ start), else open a new lane.
 * Lane 0 is closest to the seam. Deterministic for a given event set — the
 * type-order tiebreak makes ties between equal-start events resolve the same
 * way every render, so the column scan is stable.
 *
 * @returns per-event lane indices (in INPUT order) and the lane count used.
 */
export function assignOverlayLanes(events: OverlayEvent[]): {
  lanes: number[]
  laneCount: number
} {
  const n = events.length
  if (n === 0) return { lanes: [], laneCount: 0 }

  const indices = Array.from({ length: n }, (_, i) => i)
  indices.sort((a, b) => {
    const ds = events[a].start - events[b].start
    if (ds !== 0) return ds
    return events[a].order - events[b].order
  })

  const lanes = new Array<number>(n)
  const laneEnds: number[] = []

  for (const i of indices) {
    const { start, end } = events[i]
    let assigned = -1
    for (let lane = 0; lane < laneEnds.length; lane++) {
      if (laneEnds[lane] <= start) {
        assigned = lane
        laneEnds[lane] = end
        break
      }
    }
    if (assigned === -1) {
      assigned = laneEnds.length
      laneEnds.push(end)
    }
    lanes[i] = assigned
  }

  return { lanes, laneCount: laneEnds.length }
}

/**
 * Creates visualizable data for the ScarfPlot
 */
export function transformDataToScarfPlot(
  engine: DataEngine,
  stimulusId: number,
  participantIds: number[],
  settings: ScarfPlotSettings,
  noAoiTreatment: { displayedName: string; color: string }
): ScarfData {
  const stimulusHasEvents = hasEventsForStimulus(engine, stimulusId)
  // Events ride as an overlay on the gaze segments. The ordinal view is
  // segment-index-based, so the time-based event overlay is never shown there.
  const showEventOverlay =
    stimulusHasEvents &&
    settings.timeline !== 'ordinal' &&
    !(settings.hideEvents ?? false)

  const aoiData = getAois(engine, stimulusId)
  const timeline = createScarfPlotAxis(
    engine,
    participantIds,
    stimulusId,
    settings
  )
  const { minValue, maxValue } = timeline
  const invVisibleRange = 1 / (maxValue - minValue || 1)

  const visibleEventChannels = hasEventsForStimulus(engine, stimulusId)
    ? getVisibleEventChannels(engine, stimulusId)
    : []
  const groupedEventChannels =
    groupEventChannelsByDisplayedName(visibleEventChannels)
  const showVisibilityMarkers =
    showEventOverlay && groupedEventChannels.length > 0
  const categoryData = getAllCategories(engine)
  const hiddenCategories = getHiddenCategories(engine)
  const hiddenCategoryIds = new Set(hiddenCategories)
  // Group the non-fixation categories ONCE — shared by the styling below and the
  // category→style-index map further down (was grouped twice + filtered twice).
  const groupedCategories = groupCategoriesByDisplayedName(
    categoryData.filter(c => c.id !== FIXATION_CATEGORY_ID)
  )

  const stylingAndLegend = createStylingAndLegend(
    aoiData,
    noAoiTreatment,
    showVisibilityMarkers ? groupedEventChannels : [],
    groupedCategories
  )

  // --- Gaze segments + optional event overlay ---
  const reader = engine.getReader()
  if (!reader) throw new Error('Data engine reader not initialized')
  const aoiGroupReader = engine.getAoiGroupReader()
  if (!aoiGroupReader) throw new Error('AOI reader not initialized')

  // Style mapping: pre-calculate indices for the hot loop.
  const aoiStyleCount = stylingAndLegend.aoi.length

  // stylingAndLegend.category[i] is built 1:1 (same order) from groupedCategories[i],
  // so map each group's member category ids straight to `aoiStyleCount + i` — no
  // per-item parseInt of the identifier and no O(categories^2) `.find`.
  const categoryStyleIdxMap = new Int16Array(categoryData.length).fill(-1)
  for (let i = 0; i < groupedCategories.length; i++) {
    const memberIds = groupedCategories[i].memberIds
    for (let m = 0; m < memberIds.length; m++) {
      const memberId = memberIds[m]
      if (memberId >= 0 && memberId < categoryStyleIdxMap.length) {
        categoryStyleIdxMap[memberId] = aoiStyleCount + i
      }
    }
  }

  const visibilityBaseStyleIdx =
    aoiStyleCount + stylingAndLegend.category.length

  const stimulusAoiCount = engine.metadata?.aois.data[stimulusId]?.length ?? 0
  const maxAoiIdInMeta = Math.max(...aoiData.map(a => a.id), 0)
  const aoiBufferSize = Math.max(stimulusAoiCount, maxAoiIdInMeta + 1)
  const aoiOrderMap = new Int16Array(aoiBufferSize).fill(-1)
  for (let i = 0; i < aoiData.length; i++) aoiOrderMap[aoiData[i].id] = i

  const totalStyleCount =
    aoiStyleCount +
    stylingAndLegend.category.length +
    stylingAndLegend.visibility.length
  const rows = participantIds.length
  // Event overlay buckets only (small — one strip per merged event). There are no
  // gaze rect buckets: the renderer composites the gaze rects straight from the
  // binary segment store via `gazeSource` (see below).
  const eventBuckets = Array.from(
    { length: totalStyleCount },
    () => new Float32GrowBuffer(512)
  )

  const isOrdinal = settings.timeline === 'ordinal'
  const isRelative = settings.timeline === 'relative'
  // Hoist every reactive `settings` read OUT of the per-segment loop: `settings`
  // is a deep $state proxy (item.settings), so each property read is a proxy
  // `get` — reading `hideNonFixations` per segment cost ~190 ms on a large set.
  const hideNonFixations = settings.hideNonFixations
  const relTimelineStart = settings.timelineStart
  const relTimelineEnd = settings.timelineEnd
  const participants: ScarfParticipant[] = new Array(participantIds.length)
  // Snapshot the participant-label table once (a single proxy traversal) instead
  // of calling getParticipant() — which re-reads `engine.metadata.participants.data`
  // through the deep $state proxy — for every row inside the loop below.
  const participantData = engine.metadata?.participants.data
  // Per-participant-row projection (raw start/end → normalized x). Consumed by the
  // fused gaze render (via gazeSource) and the event overlay below.
  const projClipMin = new Float32Array(participantIds.length)
  const projClipMax = new Float32Array(participantIds.length)
  const projScale = new Float32Array(participantIds.length)
  // Observed (not theoretical) max simultaneous events across all participants.
  // Sizes the event band uniformly so the AOI seam is at a constant y.
  let observedMaxConcurrency = 0

  for (let pIndex = 0; pIndex < participantIds.length; pIndex++) {
    const pid = participantIds[pIndex]
    const sessionDuration = getParticipantEndTime(engine, stimulusId, pid)

    let clipMin = minValue
    let clipMax = maxValue
    let scale = invVisibleRange

    if (isRelative) {
      const tStart = relTimelineStart
      const tEnd = relTimelineEnd
      clipMin = typeof tStart === 'number' && !isNaN(tStart) ? tStart : 0
      clipMax = typeof tEnd === 'number' && !isNaN(tEnd) ? tEnd : 0

      if (clipMin === 0 && clipMax === 0) {
        clipMax = sessionDuration
      } else {
        if (clipMax === 0) clipMax = sessionDuration
        if (clipMax <= clipMin) clipMax = Math.max(sessionDuration, clipMin + 1)
      }
      scale = 1 / (clipMax - clipMin)
    }

    // Consumed by the fused gaze render (via gazeSource) and the event overlay below.
    projClipMin[pIndex] = clipMin
    projClipMax[pIndex] = clipMax
    projScale[pIndex] = scale

    if (showVisibilityMarkers) {
      // Merge this participant's events across ALL visible channels, pack them
      // into shared lanes (greedy, type-order tiebreak), then push each as a
      // strip into its channel bucket so the renderer can colour it by type.
      const merged: OverlayEvent[] = []
      const mStyleIdx: number[] = []
      const mX: number[] = []
      const mW: number[] = []
      const mPoint: number[] = []
      const clipRange = clipMax - clipMin || 1

      for (let chIdx = 0; chIdx < groupedEventChannels.length; chIdx++) {
        const group = groupedEventChannels[chIdx]
        const styleIdx = visibilityBaseStyleIdx + chIdx
        const chEvents: { start: number; end: number; isPoint: boolean }[] = []
        for (let mIdx = 0; mIdx < group.memberIds.length; mIdx++) {
          const buf = getEventBuffer(engine, stimulusId, group.memberIds[mIdx], pid)
          if (!buf || buf.length < 2) continue
          for (let i = 0; i + 1 < buf.length; i += 2) {
            const start = buf[i]
            const duration = buf[i + 1]
            if (duration === 0) {
              if (start < clipMin || start >= clipMax) continue
              chEvents.push({ start, end: start, isPoint: true })
            } else {
              const end = start + duration
              if (end <= clipMin || start >= clipMax) continue
              chEvents.push({ start: Math.max(clipMin, start), end: Math.min(clipMax, end), isPoint: false })
            }
          }
        }

        if (chEvents.length > 0) {
          chEvents.sort((a, b) => a.start - b.start)
          const mergedCh: typeof chEvents = []
          let curr = chEvents[0]
          for (let k = 1; k < chEvents.length; k++) {
            const next = chEvents[k]
            if (next.start <= curr.end) {
              curr.end = Math.max(curr.end, next.end)
              if (!next.isPoint) curr.isPoint = false
            } else {
              mergedCh.push(curr)
              curr = next
            }
          }
          mergedCh.push(curr)

          for (const ev of mergedCh) {
            const w = ev.isPoint ? 0 : (ev.end - ev.start) / clipRange
            if (!ev.isPoint && w <= 0) continue
            merged.push({ start: ev.start, end: ev.end, order: chIdx })
            mStyleIdx.push(styleIdx)
            mX.push((ev.start - clipMin) / clipRange)
            mW.push(w)
            mPoint.push(ev.isPoint ? 1 : 0)
          }
        }
      }

      if (merged.length > 0) {
        const { lanes, laneCount } = assignOverlayLanes(merged)
        if (laneCount > observedMaxConcurrency) observedMaxConcurrency = laneCount
        for (let i = 0; i < merged.length; i++) {
          eventBuckets[mStyleIdx[i]].pushStrip(
            mX[i],
            pIndex,
            mW[i],
            lanes[i],
            mPoint[i]
          )
        }
      }
    }

    const prow = participantData?.[pid]
    participants[pIndex] = {
      id: pid,
      label: (prow?.[1] ?? prow?.[0]) ?? '',
      width: 0,
    }
  }

  const visualEventBuckets = eventBuckets.map(b => b.finalize())

  // Fused gaze source: everything the renderer/hover/highlight need to composite
  // the gaze rects straight from the binary store — refs + the already-computed
  // style maps + the per-participant projection arrays.
  const gazeSource: ScarfGazeSource = {
    reader,
    aoiGroupReader,
    participantIds,
    stimulusId,
    isOrdinal,
    projClipMin,
    projClipMax,
    projScale,
    aoiOrderMap,
    categoryStyleIdxMap,
    noAoiStyleIdx: aoiData.length,
    hideNonFixations: !!hideNonFixations,
    hiddenCategoryIds,
  }

  return {
    id: stimulusId,
    stimulusId,
    participants,
    timeline,
    stylingAndLegend,
    legendData: createScarfLegendData(
      stylingAndLegend,
      settings.hideNonFixations,
      showVisibilityMarkers
    ),
    visualEventBuckets,
    gazeSource,
    isOverlay: showVisibilityMarkers,
    eventZoneConcurrency: observedMaxConcurrency,
  }
}

/**
 * Maps raw legend data to LegendGroup array.
 */
export function mapDataToLegendGroups(
  groups: ScarfLegendGroup[]
): LegendGroup[] {
  const getItemPresentation = (styleType: string) => {
    switch (styleType) {
      case 'fixation':
        return { type: 'fixation' as const }
      case 'nonFixation':
        return { type: 'nonFixation' as const }
      default:
        return { type: 'fixation' as const }
    }
  }

  return groups.map(group => ({
    title: group.title,
    items: group.items.map(item => {
      const presentation = getItemPresentation(item.styleType)
      return {
        identifier: item.identifier,
        name: item.name,
        color: item.color,
        type: presentation.type,
      }
    }),
  }))
}

/**
 * Computes the highlight mask based on used highlights.
 */
export function calculateHighlightMask(
  usedHighlights: string[],
  identifierSystem: { idToIndex: Map<string, number>; totalIdentifiers: number }
): Uint8Array | null {
  if (!usedHighlights || usedHighlights.length === 0) return null
  const total = identifierSystem.totalIdentifiers
  if (!total) return null

  const mask = new Uint8Array(total)
  const { idToIndex } = identifierSystem
  for (let i = 0; i < usedHighlights.length; i++) {
    const idx = idToIndex.get(usedHighlights[i])
    if (idx != null) mask[idx] = 1
  }
  return mask
}

/**
 * Creates dense style arrays for rectangles and events for O(1) access during render.
 */
export function createStyleArrays(
  identifierSystem: { indexToId: Map<number, string> },
  rectStyleMap: Map<string, ScarfRectStyle>,
  eventStyleMap: Map<string, ScarfEventStyle>,
  rectBucketCount: number,
  eventBucketCount: number
) {
  const { indexToId } = identifierSystem
  const rectFallback = { normal: { fill: '#ccc' } }
  const eventFallback = { normal: { stroke: '#ccc', strokeWidth: 1 } }

  const rectStyles = new Array(rectBucketCount)
  for (let i = 0; i < rectBucketCount; i++) {
    const id = indexToId.get(i)
    rectStyles[i] =
      id !== undefined ? (rectStyleMap.get(id) ?? rectFallback) : rectFallback
  }

  const eventStyles = new Array(eventBucketCount)
  for (let i = 0; i < eventBucketCount; i++) {
    const id = indexToId.get(i)
    eventStyles[i] =
      id !== undefined
        ? (eventStyleMap.get(id) ?? eventFallback)
        : eventFallback
  }

  return { rectStyles, eventStyles }
}
