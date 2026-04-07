/**
 * ScarfPlot Data Transformation Utilities
 */

import {
  getAois,
  getNumberOfSegments,
  getParticipant,
  getParticipantEndTime,
  getStimuli,
  hasEventsForStimulus,
  getVisibleEventChannels,
  getEventBuffer,
} from '$lib/data/engine'
import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import {
  SegmentField,
  SEGMENT_STRIDE,
  type ExtendedInterpretedDataType,
} from '$lib/data/types'
import {
  createAdaptiveTimeline,
  type AdaptiveTimeline,
} from '$lib/plots/shared'
import {
  EVENT_CHANNEL_STRIDE,
  EVENT_STRIDE,
  RECT_STRIDE,
  SCARF_IDENTIFIERS,
  SCARF_LAYOUT,
} from '../const'
import type {
  ScarfData,
  ScarfDisplayMode,
  ScarfLegendData,
  ScarfLegendGroup,
  ScarfLegendItem,
  ScarfLegendStyleType,
  ScarfParticipant,
  ScarfPlotSettings,
  ScarfStyleItem,
  ScarfStyling,
} from '../types'
import type { LegendGroup } from '$lib/plots/shared'

export class Float32GrowBuffer {
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

  pushRect(
    x: number,
    y: number,
    width: number,
    height: number,
    participantId: number,
    segmentId: number,
    orderId: number,
    internalY: number
  ) {
    this.ensureCapacity(RECT_STRIDE)

    const idx = this.writeIndex
    const b = this.buffer

    b[idx] = x
    b[idx + 1] = y
    b[idx + 2] = width
    b[idx + 3] = height
    b[idx + 4] = participantId
    b[idx + 5] = segmentId
    b[idx + 6] = orderId
    b[idx + 7] = internalY

    this.writeIndex += RECT_STRIDE
  }

  pushEvent(
    x: number,
    pIndex: number,
    eventType: number,
    participantId: number,
    internalY: number
  ) {
    this.ensureCapacity(EVENT_STRIDE)

    const idx = this.writeIndex
    const b = this.buffer

    b[idx] = x
    b[idx + 1] = pIndex
    b[idx + 2] = eventType
    b[idx + 3] = participantId
    b[idx + 4] = internalY

    this.writeIndex += EVENT_STRIDE
  }

  finalize(): Float32Array {
    return this.buffer.subarray(0, this.writeIndex)
  }
}

/**
 * Calculates the participant bar height based on configuration parameters
 */
export function getScarfParticipantBarHeight(): number {
  const { HEIGHT_BAR_DEFAULT, SPACE_ABOVE_RECT_DEFAULT } = SCARF_LAYOUT
  const rectWrappedHeight = HEIGHT_BAR_DEFAULT + SPACE_ABOVE_RECT_DEFAULT * 2

  // Events are drawn centered on the participant bar – do not increase
  // participant bar height for visibility rows (no toggle/backcompat needed).
  return rectWrappedHeight
}

/**
 * Calculates the timeline range for the plot based on settings and participant data
 */
export function calculateTimelineRange(
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
export function createScarfPlotAxis(
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
export function createStylingAndLegend(
  aoiData: ExtendedInterpretedDataType[],
  noAoiTreatment: { displayedName: string; color: string },
  eventChannelData: ExtendedInterpretedDataType[] = []
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

  const category: ScarfStyleItem[] = [
    {
      identifier: `${SCARF_IDENTIFIERS.CATEGORY}1`,
      name: 'Saccade',
      color: '#555555',
    },
    {
      identifier: `${SCARF_IDENTIFIERS.CATEGORY}${SCARF_IDENTIFIERS.NOT_DEFINED}`,
      name: 'Other',
      color: '#a6a6a6',
    },
  ]

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
  if (eventChannels.length === 0) return []

  const grouped: GroupedEventChannel[] = []
  const processed = new Set<number>()

  for (let i = 0; i < eventChannels.length; i++) {
    const channel = eventChannels[i]
    if (processed.has(channel.id)) continue

    const trimmedName = (channel.displayedName || '').trim()
    const memberIds = [channel.id]
    processed.add(channel.id)

    if (trimmedName.length > 0) {
      for (let j = i + 1; j < eventChannels.length; j++) {
        const candidate = eventChannels[j]
        if (processed.has(candidate.id)) continue
        if ((candidate.displayedName || '').trim() === trimmedName) {
          memberIds.push(candidate.id)
          processed.add(candidate.id)
        }
      }
    }

    grouped.push({
      id: channel.id,
      originalName: channel.originalName,
      displayedName: channel.displayedName,
      color: channel.color,
      memberIds,
    })
  }

  return grouped
}

/**
 * Resolves the display mode based on user request and available data.
 * When the current stimulus has no event data, always falls back to 'segments'
 * regardless of the user's setting.
 */
export function resolveDisplayMode(
  requested: ScarfDisplayMode | undefined,
  hasSegmented: boolean,
  stimulusHasEvents: boolean
): ScarfDisplayMode {
  // No event data for this stimulus — force segments regardless of setting
  if (!stimulusHasEvents) return 'segments'

  if (requested === 'events' && stimulusHasEvents) return 'events'
  if (requested === 'segments' && hasSegmented) return 'segments'
  if (requested === 'overlay' && hasSegmented) return 'overlay'

  // Auto-detect: if both available, default to overlay; else whichever is available
  if (hasSegmented && stimulusHasEvents) return 'overlay'
  if (stimulusHasEvents) return 'events'
  return 'segments'
}

/**
 * Greedy depth assignment for overlapping events in a stride-2 buffer [start, duration, ...].
 * Returns per-event depth indices and the maximum depth used.
 */
export function assignEventDepths(events: number[]): {
  depths: number[]
  maxDepth: number
} {
  const eventCount = Math.floor(events.length / 2)
  if (eventCount === 0) return { depths: [], maxDepth: 1 }

  // Build sorted index by start time
  const indices = Array.from({ length: eventCount }, (_, i) => i)
  indices.sort((a, b) => events[a * 2] - events[b * 2])

  const depths = new Array<number>(eventCount)
  const laneEnds: number[] = [] // end time of each lane

  for (const sortedIdx of indices) {
    const start = events[sortedIdx * 2]
    const duration = events[sortedIdx * 2 + 1]
    const end = start + duration

    // Find first lane where the event fits
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

    depths[sortedIdx] = assigned
  }

  return { depths, maxDepth: Math.max(1, laneEnds.length) }
}

/**
 * Creates group-aware legend data from styling information.
 */
export function createScarfLegendData(
  styling: ScarfStyling,
  hideNonFixations = false,
  displayMode: ScarfDisplayMode = 'overlay'
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

  if (displayMode !== 'events') {
    addGroup('Fixations', styling.aoi, 'fixation')
    if (!hideNonFixations) {
      addGroup('Non-fixations', styling.category, 'nonFixation')
    }
  }

  if (displayMode === 'events') {
    // Events-only mode: show channels as fixation-style rectangles
    addGroup('Event Channels', styling.visibility, 'fixation')
  } else if (displayMode === 'overlay') {
    addGroup('Event Channels', styling.visibility, 'visibility')
  }
  // 'segments' mode: no event legend group

  return { groups }
}

/**
 * Directly appends visibility events to the provided buffer builder.
 * Avoids any intermediate object or array allocation.
 */
export function appendVisibilityEventsToBuffer(
  builder: Float32GrowBuffer,
  visibility: number[],
  minValue: number,
  maxValue: number,
  visibleRange: number,
  pIndex: number,
  participantId: number,
  internalY: number
): void {
  if (!visibility || visibility.length === 0) return

  const len = visibility.length
  // Process pairs (start, end)
  for (let i = 0; i < len; i += 2) {
    const s = visibility[i]
    const e = visibility[i + 1]

    if (e === undefined || e === null) {
      // Open-ended interval - emit start-only if in range
      if (s >= minValue && s < maxValue) {
        const x1 = (Math.max(minValue, s) - minValue) / visibleRange
        builder.pushEvent(x1, pIndex, 0, participantId, internalY)
      }
      continue
    }
    if (e <= minValue || s >= maxValue) continue
    const x1 = (Math.max(minValue, s) - minValue) / visibleRange
    const x2 = (Math.min(maxValue, e) - minValue) / visibleRange
    if (x2 > x1) {
      builder.pushEvent(x1, pIndex, 0, participantId, internalY)
      builder.pushEvent(x2, pIndex, 1, participantId, internalY)
    }
  }
}

/**
 * Appends stride-2 event buffer [start, duration, ...] to the visual event buffer.
 * Converts start+duration to start/end marker pairs for rendering.
 */
export function appendEventBufferToVisualBuffer(
  builder: Float32GrowBuffer,
  events: number[],
  minValue: number,
  maxValue: number,
  visibleRange: number,
  pIndex: number,
  participantId: number,
  internalY: number
): void {
  if (!events || events.length < 2) return

  const len = events.length
  for (let i = 0; i < len; i += 2) {
    const start = events[i]
    const duration = events[i + 1]

    if (duration === 0) {
      // Discrete event — emit single marker if in range
      if (start >= minValue && start < maxValue) {
        const x = (start - minValue) / visibleRange
        builder.pushEvent(x, pIndex, 0, participantId, internalY)
      }
      continue
    }

    const end = start + duration
    if (end <= minValue || start >= maxValue) continue
    const x1 = (Math.max(minValue, start) - minValue) / visibleRange
    const x2 = (Math.min(maxValue, end) - minValue) / visibleRange
    if (x2 > x1) {
      builder.pushEvent(x1, pIndex, 0, participantId, internalY)
      builder.pushEvent(x2, pIndex, 1, participantId, internalY)
    }
  }
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
  const caps = engine.capabilities
  const stimulusHasEvents = hasEventsForStimulus(engine, stimulusId)
  // Ordinal view is segment-index-based — force segments only
  const requestedMode = settings.timeline === 'ordinal'
    ? 'segments'
    : settings.displayMode
  const displayMode = resolveDisplayMode(
    requestedMode,
    caps.segmented,
    stimulusHasEvents
  )

  const {
    HEIGHT_BAR_DEFAULT,
    HEIGHT_NON_FIXATION_DEFAULT,
    SPACE_ABOVE_RECT_DEFAULT,
    HEIGHT_X_AXIS,
  } = SCARF_LAYOUT

  const aoiData = displayMode !== 'events' ? getAois(engine, stimulusId) : []
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
    displayMode === 'overlay' &&
    groupedEventChannels.length > 0 &&
    settings.timeline !== 'ordinal'
  const barWrapHeight = getScarfParticipantBarHeight()
  const stylingAndLegend = createStylingAndLegend(
    aoiData,
    noAoiTreatment,
    (showVisibilityMarkers || displayMode === 'events')
      ? groupedEventChannels
      : []
  )

  // --- Events-only mode ---
  if (displayMode === 'events') {
    return transformEventOnlyMode(
      engine,
      stimulusId,
      participantIds,
      settings,
      groupedEventChannels,
      timeline,
      stylingAndLegend,
      displayMode
    )
  }

  // --- Segments or Overlay mode ---
  if (!engine.segments) throw new Error('Data engine not initialized')
  const aoiGroupReader = engine.getAoiGroupReader()
  if (!aoiGroupReader) throw new Error('AOI reader not initialized')

  // Style mapping: pre-calculate indices for the hot loop
  const aoiStyleCount = stylingAndLegend.aoi.length
  const saccadeStyleIdx = aoiStyleCount
  const otherCategoryStyleIdx = aoiStyleCount + 1
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
  const rectBuckets = Array.from(
    { length: totalStyleCount },
    () => new Float32GrowBuffer(1024)
  )
  const eventBuckets = Array.from(
    { length: totalStyleCount },
    () => new Float32GrowBuffer(512)
  )

  const isOrdinal = settings.timeline === 'ordinal'
  const isRelative = settings.timeline === 'relative'
  const { segmentBuffer, indexTable, maxParticipants } = engine.segments
  const participants: ScarfParticipant[] = new Array(participantIds.length)
  const overlapAoiBuffer = new Uint16Array(aoiBufferSize)

  for (let pIndex = 0; pIndex < participantIds.length; pIndex++) {
    const pid = participantIds[pIndex]
    const sessionDuration = getParticipantEndTime(engine, stimulusId, pid)

    let clipMin = minValue
    let clipMax = maxValue
    let scale = invVisibleRange

    if (isRelative) {
      const tStart = settings.timelineStart
      const tEnd = settings.timelineEnd
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

    const rangeIdx = (stimulusId * maxParticipants + pid) * 2
    const startIndex = indexTable[rangeIdx]
    const segmentCount = indexTable[rangeIdx + 1] - startIndex

    for (let localId = 0; localId < segmentCount; localId++) {
      const base = (startIndex + localId) * SEGMENT_STRIDE
      const categoryId = segmentBuffer[base + SegmentField.CATEGORY_ID] | 0
      let start = isOrdinal
        ? localId
        : segmentBuffer[base + SegmentField.START_TIME]
      let end = isOrdinal
        ? localId + 1
        : segmentBuffer[base + SegmentField.END_TIME]

      if (end <= clipMin || start >= clipMax) continue
      start = Math.max(clipMin, start)
      end = Math.min(clipMax, end)

      const x = (start - clipMin) * scale
      const width = (end - start) * scale

      if (categoryId !== 0) {
        if (settings.hideNonFixations) continue

        rectBuckets[
          categoryId === 1 ? saccadeStyleIdx : otherCategoryStyleIdx
        ].pushRect(
          x,
          pIndex,
          width,
          HEIGHT_NON_FIXATION_DEFAULT,
          pid,
          localId,
          localId,
          SPACE_ABOVE_RECT_DEFAULT +
            (HEIGHT_BAR_DEFAULT - HEIGHT_NON_FIXATION_DEFAULT) * 0.5
        )
      } else {
        const count = aoiGroupReader.getSegmentAoisIntoUniqueTyped(
          startIndex + localId,
          stimulusId,
          overlapAoiBuffer
        )
        if (count === 0) {
          rectBuckets[aoiData.length].pushRect(
            x,
            pIndex,
            width,
            HEIGHT_BAR_DEFAULT,
            pid,
            localId,
            localId,
            SPACE_ABOVE_RECT_DEFAULT
          )
        } else {
          const h = HEIGHT_BAR_DEFAULT / count
          for (let i = 0; i < count; i++) {
            const bucketIdx = aoiOrderMap[overlapAoiBuffer[i]]
            if (bucketIdx < 0) continue
            rectBuckets[bucketIdx].pushRect(
              x,
              pIndex,
              width,
              h,
              pid,
              localId,
              localId,
              SPACE_ABOVE_RECT_DEFAULT + i * h
            )
          }
        }
      }
    }

    if (showVisibilityMarkers) {
      const internalY = SPACE_ABOVE_RECT_DEFAULT + HEIGHT_BAR_DEFAULT * 0.5
      for (let chIdx = 0; chIdx < groupedEventChannels.length; chIdx++) {
        const group = groupedEventChannels[chIdx]
        for (let mIdx = 0; mIdx < group.memberIds.length; mIdx++) {
          const buf = getEventBuffer(
            engine,
            stimulusId,
            group.memberIds[mIdx],
            pid
          )
          if (buf && buf.length >= 2) {
            appendEventBufferToVisualBuffer(
              eventBuckets[visibilityBaseStyleIdx + chIdx],
              buf,
              clipMin,
              clipMax,
              clipMax - clipMin || 1,
              pIndex,
              pid,
              internalY
            )
          }
        }
      }
    }

    participants[pIndex] = {
      id: pid,
      label: getParticipant(engine, pid).displayedName,
      width: 0,
    }
  }

  return {
    id: stimulusId,
    timelineType: settings.timeline,
    barHeight: HEIGHT_BAR_DEFAULT,
    stimulusId,
    heightOfBarWrap: barWrapHeight,
    chartHeight: participantIds.length * barWrapHeight + HEIGHT_X_AXIS,
    stimuli: getStimuli(engine).map(s => ({ id: s.id, name: s.displayedName })),
    participants,
    timeline,
    stylingAndLegend,
    legendData: createScarfLegendData(
      stylingAndLegend,
      settings.hideNonFixations,
      displayMode
    ),
    leftLabelWidth: 0,
    plotAreaWidth: 0,
    visualRectBuckets: rectBuckets.map(b => b.finalize()),
    visualEventBuckets: eventBuckets.map(b => b.finalize()),
    resolvedDisplayMode: displayMode,
  }
}

/**
 * Transforms data for events-only display mode.
 * Produces gantt-style event channel rectangles with depth stacking.
 */
function transformEventOnlyMode(
  engine: DataEngine,
  stimulusId: number,
  participantIds: number[],
  settings: ScarfPlotSettings,
  groupedEventChannels: ReturnType<typeof groupEventChannelsByDisplayedName>,
  timeline: ReturnType<typeof createScarfPlotAxis>,
  stylingAndLegend: ScarfStyling,
  displayMode: ScarfDisplayMode
): ScarfData {
  const { HEIGHT_BAR_DEFAULT, SPACE_ABOVE_RECT_DEFAULT, HEIGHT_X_AXIS } =
    SCARF_LAYOUT
  const { minValue, maxValue } = timeline
  const visibleRange = maxValue - minValue || 1

  const channelCount = groupedEventChannels.length
  const eventChannels = groupedEventChannels.map(g => ({
    id: g.id,
    name: g.displayedName || g.originalName,
    color: g.color,
  }))

  // First pass: determine max depths per channel across all participants
  const channelMaxDepths = new Array<number>(channelCount).fill(1)

  for (const pid of participantIds) {
    for (let chIdx = 0; chIdx < channelCount; chIdx++) {
      const group = groupedEventChannels[chIdx]
      // Collect all events from all members of this group for this participant
      const allEvents: number[] = []
      for (const memberId of group.memberIds) {
        const buf = getEventBuffer(engine, stimulusId, memberId, pid)
        if (buf && buf.length >= 2) {
          for (let i = 0; i < buf.length; i++) allEvents.push(buf[i])
        }
      }
      if (allEvents.length >= 2) {
        const { maxDepth } = assignEventDepths(allEvents)
        channelMaxDepths[chIdx] = Math.max(channelMaxDepths[chIdx], maxDepth)
      }
    }
  }

  const totalLanesPerParticipant = channelMaxDepths.reduce((s, d) => s + d, 0)
  const barWrapHeight = getScarfParticipantBarHeight()

  // Second pass: build event channel buffer
  const builder = new Float32GrowBuffer(4096)
  const participants: ScarfParticipant[] = new Array(participantIds.length)
  const isRelative = settings.timeline === 'relative'

  // Pre-compute lane offsets per channel
  const channelLaneOffset = new Array<number>(channelCount)
  let offset = 0
  for (let i = 0; i < channelCount; i++) {
    channelLaneOffset[i] = offset
    offset += channelMaxDepths[i]
  }

  for (let pIndex = 0; pIndex < participantIds.length; pIndex++) {
    const pid = participantIds[pIndex]

    // Per-participant clipping range (same logic as segment transformer)
    let clipMin = minValue
    let clipMax = maxValue
    let clipRange = visibleRange

    if (isRelative) {
      const sessionDuration = getParticipantEndTime(engine, stimulusId, pid)
      const tStart = settings.timelineStart
      const tEnd = settings.timelineEnd
      clipMin = typeof tStart === 'number' && !isNaN(tStart) ? tStart : 0
      clipMax = typeof tEnd === 'number' && !isNaN(tEnd) ? tEnd : 0

      if (clipMin === 0 && clipMax === 0) {
        clipMax = sessionDuration
      } else {
        if (clipMax === 0) clipMax = sessionDuration
        if (clipMax <= clipMin) clipMax = Math.max(sessionDuration, clipMin + 1)
      }
      clipRange = clipMax - clipMin || 1
    }

    for (let chIdx = 0; chIdx < channelCount; chIdx++) {
      const group = groupedEventChannels[chIdx]
      const allEvents: number[] = []
      for (const memberId of group.memberIds) {
        const buf = getEventBuffer(engine, stimulusId, memberId, pid)
        if (buf && buf.length >= 2) {
          for (let i = 0; i < buf.length; i++) allEvents.push(buf[i])
        }
      }
      if (allEvents.length < 2) continue

      const { depths } = assignEventDepths(allEvents)
      const eventCount = allEvents.length / 2

      for (let i = 0; i < eventCount; i++) {
        const start = allEvents[i * 2]
        const duration = allEvents[i * 2 + 1]
        const end = start + duration

        if (end <= clipMin || start >= clipMax) continue
        const clippedStart = Math.max(clipMin, start)
        const clippedEnd = Math.min(clipMax, end)

        const x = (clippedStart - clipMin) / clipRange
        const w = (clippedEnd - clippedStart) / clipRange
        if (w <= 0) continue

        const laneIndex = channelLaneOffset[chIdx] + depths[i]

        // EVENT_CHANNEL_STRIDE = 5: [xNorm, wNorm, laneIndex, pIndex, channelIndex]
        builder.pushEvent(x, w, laneIndex, pIndex, chIdx)
      }
    }

    participants[pIndex] = {
      id: pid,
      label: getParticipant(engine, pid).displayedName,
      width: 0,
    }
  }

  return {
    id: stimulusId,
    timelineType: settings.timeline,
    barHeight: HEIGHT_BAR_DEFAULT,
    stimulusId,
    heightOfBarWrap: barWrapHeight,
    chartHeight: participantIds.length * barWrapHeight + HEIGHT_X_AXIS,
    stimuli: getStimuli(engine).map(s => ({ id: s.id, name: s.displayedName })),
    participants,
    timeline,
    stylingAndLegend,
    legendData: createScarfLegendData(
      stylingAndLegend,
      settings.hideNonFixations,
      displayMode
    ),
    leftLabelWidth: 0,
    plotAreaWidth: 0,
    visualRectBuckets: [],
    visualEventBuckets: [],
    resolvedDisplayMode: displayMode,
    eventChannels,
    channelMaxDepths,
    totalLanesPerParticipant,
    visualEventChannelBuffer: builder.finalize(),
  }
}

/**
 * Testable helper for visibility interval transformation.
 * Primarily used by unit tests to verify interval logic without Float32Array management.
 */
export function convertVisibilityIntervalsToEvents(
  visibility: number[],
  minValue: number,
  maxValue: number,
  visibleRange: number
): Array<{ x: number; type: number }> {
  const events: Array<{ x: number; type: number }> = []
  if (!visibility || visibility.length === 0) return events

  const len = visibility.length
  for (let i = 0; i < len; i += 2) {
    const s = visibility[i]
    const e = visibility[i + 1]

    if (e === undefined || e === null) {
      if (s >= minValue && s < maxValue) {
        events.push({
          x: (Math.max(minValue, s) - minValue) / visibleRange,
          type: 0,
        })
      }
      continue
    }
    if (e <= minValue || s >= maxValue) continue
    const x1 = (Math.max(minValue, s) - minValue) / visibleRange
    const x2 = (Math.min(maxValue, e) - minValue) / visibleRange
    if (x2 > x1) {
      events.push({ x: x1, type: 0 })
      events.push({ x: x2, type: 1 })
    }
  }
  return events
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
      case 'visibility':
        return { type: 'eventPair' as const }
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
  rectStyleMap: Map<string, { normal: any; dimmed: any }>,
  eventStyleMap: Map<string, { normal: any; dimmed: any }>,
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

/**
 * Calculates vertical offsets for overlapping events to avoid visual clutter.
 */
export function calculateEventLayoutOverrides(
  isCompactMode: boolean,
  visualEventBuckets: Float32Array[],
  barHeight: number,
  barWrapHeight: number
): Map<number, number> {
  if (isCompactMode) return new Map<number, number>()
  if (visualEventBuckets.length === 0) return new Map<number, number>()

  const size = Math.max(7, Math.min(20, barHeight * 0.8))
  const normalizedThreshold = (size * 0.25) / 1000
  const KEY_MULTIPLIER = 1000000

  let totalEvents = 0
  for (let i = 0; i < visualEventBuckets.length; i++) {
    totalEvents += visualEventBuckets[i].length / EVENT_STRIDE
  }

  if (totalEvents === 0) return new Map<number, number>()

  const indices = new Int32Array(totalEvents)
  const xPos = new Float32Array(totalEvents)
  const pIds = new Int16Array(totalEvents)
  const styleIds = new Int16Array(totalEvents)
  const eventIndices = new Int32Array(totalEvents)

  let ptr = 0
  for (let styleIdx = 0; styleIdx < visualEventBuckets.length; styleIdx++) {
    const buffer = visualEventBuckets[styleIdx]
    const count = buffer.length / EVENT_STRIDE

    for (let i = 0; i < count; i++) {
      const idx = i * EVENT_STRIDE
      xPos[ptr] = buffer[idx]
      pIds[ptr] = buffer[idx + 1]
      styleIds[ptr] = styleIdx
      eventIndices[ptr] = i
      indices[ptr] = ptr
      ptr++
    }
  }

  indices.sort((a, b) => {
    const pDiff = pIds[a] - pIds[b]
    if (pDiff !== 0) return pDiff
    return xPos[a] - xPos[b]
  })

  const overrides = new Map<number, number>()
  let clusterStart = 0
  const radius = size / 2
  const margin = radius + 2
  const minY = margin
  const maxY = barWrapHeight - margin
  const rangeY = maxY - minY
  const clusterIndices: number[] = []

  for (let i = 0; i < totalEvents; i++) {
    const currIdx = indices[i]
    const nextIdx = i < totalEvents - 1 ? indices[i + 1] : -1
    let breakCluster =
      nextIdx === -1 ||
      pIds[currIdx] !== pIds[nextIdx] ||
      xPos[nextIdx] - xPos[currIdx] >= normalizedThreshold

    if (breakCluster) {
      const clusterLen = i - clusterStart + 1
      if (clusterLen > 1) {
        clusterIndices.length = 0
        for (let k = clusterStart; k <= i; k++) clusterIndices.push(indices[k])

        clusterIndices.sort((a, b) => styleIds[a] - styleIds[b])

        if (minY < maxY) {
          const step = rangeY / Math.max(1, clusterLen - 1)
          for (let k = 0; k < clusterLen; k++) {
            const originalIdx = clusterIndices[k]
            const key =
              styleIds[originalIdx] * KEY_MULTIPLIER + eventIndices[originalIdx]
            overrides.set(key, minY + step * k)
          }
        } else {
          const center = barWrapHeight / 2
          for (let k = 0; k < clusterLen; k++) {
            const originalIdx = clusterIndices[k]
            const key =
              styleIds[originalIdx] * KEY_MULTIPLIER + eventIndices[originalIdx]
            overrides.set(key, center)
          }
        }
      }
      clusterStart = i + 1
    }
  }

  return overrides
}
