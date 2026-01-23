/**
 * ScarfPlot Data Transformation Utilities
 */

import {
  getAois,
  getAoiIdMapping,
  getAoiVisibility,
  getData,
  getHiddenAois,
  getNumberOfSegments,
  getParticipant,
  getParticipantEndTime,
  getStimuli,
  hasStimulusAoiVisibility,
} from '$lib/gaze-data/front-process/stores/dataStore'
import {
  MAX_AOI_PER_STIMULUS,
  SegmentField,
  SEGMENT_STRIDE,
  type ExtendedInterpretedDataType,
} from '$lib/gaze-data/shared/types'
import {
  createAdaptiveTimeline,
  type AdaptiveTimeline,
} from '$lib/plots/shared'
import type { ScarfGridType } from '$lib/workspace/type/gridType'
import { SCARF_IDENTIFIERS, SCARF_LAYOUT } from '../const'
import type {
  ScarfData,
  ScarfLegendData,
  ScarfLegendGroup,
  ScarfLegendItem,
  ScarfLegendStyleType,
  ScarfParticipant,
  ScarfStyleItem,
  ScarfStyling,
} from '../types'
import type { LegendGroup } from '$lib/plots/shared'

const RECT_STRIDE = 8
const EVENT_STRIDE = 5

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
export function getScarfParticipantBarHeight(
  aoiCount: number,
  showAoiVisibility: boolean
): number {
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
  participantIds: number[],
  stimulusId: number,
  settings: ScarfGridType
): { minValue: number; maxValue: number } {
  if (settings.timeline === 'relative') {
    return { minValue: 0, maxValue: 100 }
  }

  // 1. Try stimulus-specific overrides from settings
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

  // 2. Fallback to data-driven range
  let maxValue = 0
  const isOrdinal = settings.timeline === 'ordinal'

  for (const pid of participantIds) {
    if (isOrdinal) {
      maxValue = Math.max(maxValue, getNumberOfSegments(stimulusId, pid))
    } else {
      maxValue = Math.max(maxValue, getParticipantEndTime(stimulusId, pid))
    }
  }

  return {
    minValue: 0,
    maxValue: maxValue > 0 ? maxValue : isOrdinal ? 10 : 1000,
  }
}

/**
 * Creates the axis breaks for the scarf plot
 */
export function createScarfPlotAxis(
  participantIds: number[],
  stimulusId: number,
  settings: ScarfGridType
): AdaptiveTimeline {
  const { minValue, maxValue } = calculateTimelineRange(
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
  showAoiVisibility = false
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
  if (showAoiVisibility) {
    for (let i = 0; i < aoiData.length; i++) {
      const a = aoiData[i]
      visibility.push({
        identifier: `${SCARF_IDENTIFIERS.EVENT}${a.id}`,
        name: a.displayedName,
        color: a.color,
      })
    }
  }

  return { aoi, category, visibility }
}

/**
 * Creates group-aware legend data from styling information.
 * This is a data-only transformation - no layout geometry is computed here.
 * Layout geometry (including icon heights) is computed in the Svelte component
 * based on viewport width and layout constants.
 *
 * @param styling - The styling information from createStylingAndLegend
 * @returns A ScarfLegendData object with categorized groups
 */
/**
 * Creates group-aware legend data from styling information.
 */
export function createScarfLegendData(styling: ScarfStyling): ScarfLegendData {
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
  addGroup('Non-fixations', styling.category, 'nonFixation')
  addGroup('Events (start/end)', styling.visibility, 'visibility')

  return { groups }
}

/**
 * Directly appends visibility events to the provided buffer builder.
 * Avoids any intermediate object or array allocation.
 */
export function appendVisibilityEventsToBuffer(
  builder: Float32GrowBuffer,
  visibility: number[],
  isRelative: boolean,
  sessionDuration: number,
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

    if (isRelative) {
      const safeDur = sessionDuration > 0 ? sessionDuration : 1
      const x1 = Math.max(0, s / safeDur)
      if (e === undefined || e === null) {
        // Open-ended interval - emit start-only
        builder.pushEvent(x1, pIndex, 0, participantId, internalY)
        continue
      }
      const x2 = Math.min(1, e / safeDur)
      if (x2 > x1) {
        builder.pushEvent(x1, pIndex, 0, participantId, internalY)
        builder.pushEvent(x2, pIndex, 1, participantId, internalY)
      }
    } else {
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
}

/**
 * Creates visualizable data for the ScarfPlot
 */
export function transformDataToScarfPlot(
  stimulusId: number,
  participantIds: number[],
  settings: ScarfGridType,
  noAoiTreatment: { displayedName: string; color: string }
): ScarfData {
  const {
    HEIGHT_BAR_DEFAULT: HEIGHT_OF_BAR,
    HEIGHT_NON_FIXATION_DEFAULT: NON_FIXATION_HEIGHT,
    SPACE_ABOVE_RECT_DEFAULT: SPACE_ABOVE_RECT,
    HEIGHT_X_AXIS: HEIGHT_OF_X_AXIS,
  } = SCARF_LAYOUT

  const aoiData = getAois(stimulusId)
  const stimuliData = getStimuli()
  const timeline = createScarfPlotAxis(participantIds, stimulusId, settings)
  const { minValue, maxValue } = timeline
  const visibleRange = maxValue - minValue

  const showAoiVisibility =
    hasStimulusAoiVisibility(stimulusId) && settings.timeline !== 'ordinal'

  const barWrapHeight = getScarfParticipantBarHeight(
    aoiData.length,
    showAoiVisibility
  )

  const stylingAndLegend = createStylingAndLegend(
    aoiData,
    noAoiTreatment,
    showAoiVisibility
  )

  const stimuli = getStimuli().map(s => ({ id: s.id, name: s.displayedName }))

  // Style mapping: pre-calculate indices for the hot loop
  const aoiStyleCount = stylingAndLegend.aoi.length
  const saccadeStyleIdx = aoiStyleCount
  const otherCategoryStyleIdx = aoiStyleCount + 1
  const visibilityBaseStyleIdx =
    aoiStyleCount + stylingAndLegend.category.length

  const aoiOrderMap = new Int16Array(MAX_AOI_PER_STIMULUS).fill(-1)
  for (let i = 0; i < aoiData.length; i++) {
    const id = aoiData[i].id
    if (id >= 0 && id < MAX_AOI_PER_STIMULUS) aoiOrderMap[id] = i
  }

  const hiddenFlag = new Uint8Array(MAX_AOI_PER_STIMULUS)
  for (const id of getHiddenAois(stimulusId)) {
    if (id >= 0 && id < MAX_AOI_PER_STIMULUS) hiddenFlag[id] = 1
  }

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

  const { segments } = getData()
  const { segmentBuffer, indexTable, aoiPool, maxParticipants } = segments

  const participants: ScarfParticipant[] = new Array(participantIds.length)
  const overlapAoiBuffer = new Int16Array(MAX_AOI_PER_STIMULUS) // Reuse buffer for overlapping AOIs

  for (let pIndex = 0; pIndex < participantIds.length; pIndex++) {
    const pid = participantIds[pIndex]
    const sessionDuration = getParticipantEndTime(stimulusId, pid)

    const rangeIdx = (stimulusId * maxParticipants + pid) * 2
    const startIndex = indexTable[rangeIdx]
    const segmentCount = indexTable[rangeIdx + 1] - startIndex

    for (let localId = 0; localId < segmentCount; localId++) {
      const base = (startIndex + localId) * SEGMENT_STRIDE
      const categoryId = segmentBuffer[base + SegmentField.CATEGORY_ID] | 0
      const startTime = segmentBuffer[base + SegmentField.START_TIME]
      const endTime = segmentBuffer[base + SegmentField.END_TIME]

      let start = isOrdinal ? localId : startTime
      let end = isOrdinal ? localId + 1 : endTime

      if (!isRelative) {
        if (end <= minValue || start >= maxValue) continue
        start = Math.max(minValue, start)
        end = Math.min(maxValue, end)
      }

      const x = isRelative
        ? start / (sessionDuration || 1)
        : (start - minValue) / visibleRange
      const width = isRelative
        ? (end - start) / (sessionDuration || 1)
        : (end - start) / visibleRange

      if (categoryId !== 0) {
        rectBuckets[
          categoryId === 1 ? saccadeStyleIdx : otherCategoryStyleIdx
        ].pushRect(
          x,
          pIndex,
          width,
          NON_FIXATION_HEIGHT,
          pid,
          localId,
          localId,
          SPACE_ABOVE_RECT + (HEIGHT_OF_BAR - NON_FIXATION_HEIGHT) / 2
        )
      } else {
        const pStart = segmentBuffer[base + SegmentField.AOI_POINTER] | 0
        const pCount = segmentBuffer[base + SegmentField.AOI_COUNT] | 0

        let overlapCount = 0
        for (let i = 0; i < pCount; i++) {
          const aoiId = aoiPool[pStart + i]
          if (
            aoiId >= 0 &&
            aoiId < MAX_AOI_PER_STIMULUS &&
            hiddenFlag[aoiId] === 0
          ) {
            const mappedId = getAoiIdMapping(stimulusId, aoiId)

            // Deduplicate: only add if this mapped group isn't already in the list
            let alreadyAdded = false
            for (let j = 0; j < overlapCount; j++) {
              if (overlapAoiBuffer[j] === mappedId) {
                alreadyAdded = true
                break
              }
            }

            if (!alreadyAdded) {
              overlapAoiBuffer[overlapCount++] = mappedId
            }
          }
        }

        if (overlapCount === 0) {
          rectBuckets[aoiData.length].pushRect(
            x,
            pIndex,
            width,
            HEIGHT_OF_BAR,
            pid,
            localId,
            localId,
            SPACE_ABOVE_RECT
          )
        } else {
          const h = HEIGHT_OF_BAR / overlapCount
          for (let i = 0; i < overlapCount; i++) {
            rectBuckets[aoiOrderMap[overlapAoiBuffer[i]]].pushRect(
              x,
              pIndex,
              width,
              h,
              pid,
              localId,
              localId,
              SPACE_ABOVE_RECT + i * h
            )
          }
        }
      }
    }

    if (showAoiVisibility) {
      const internalY = SPACE_ABOVE_RECT + HEIGHT_OF_BAR / 2
      for (let aoiIdx = 0; aoiIdx < aoiData.length; aoiIdx++) {
        const visibility = getAoiVisibility(stimulusId, aoiData[aoiIdx].id, pid)
        if (visibility?.length) {
          appendVisibilityEventsToBuffer(
            eventBuckets[visibilityBaseStyleIdx + aoiIdx],
            visibility,
            isRelative,
            sessionDuration,
            minValue,
            maxValue,
            visibleRange,
            pIndex,
            pid,
            internalY
          )
        }
      }
    }

    participants[pIndex] = {
      id: pid,
      label: getParticipant(pid).displayedName,
      width: 0,
    }
  }

  return {
    id: stimulusId,
    timelineType: settings.timeline,
    barHeight: HEIGHT_OF_BAR,
    stimulusId,
    heightOfBarWrap: getScarfParticipantBarHeight(
      aoiData.length,
      showAoiVisibility
    ),
    chartHeight:
      participantIds.length *
        getScarfParticipantBarHeight(aoiData.length, showAoiVisibility) +
      HEIGHT_OF_X_AXIS,
    stimuli,
    participants,
    timeline,
    stylingAndLegend,
    legendData: createScarfLegendData(stylingAndLegend),
    leftLabelWidth: 0,
    plotAreaWidth: 0,
    visualRectBuckets: rectBuckets.map(b => b.finalize()),
    visualEventBuckets: eventBuckets.map(b => b.finalize()),
  }
}

/**
 * Testable helper for visibility interval transformation.
 * Primarily used by unit tests to verify interval logic without Float32Array management.
 */
export function convertVisibilityIntervalsToEvents(
  visibility: number[],
  isRelative: boolean,
  sessionDuration: number,
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

    if (isRelative) {
      const safeDur = sessionDuration > 0 ? sessionDuration : 1
      const x1 = Math.max(0, s / safeDur)
      if (e === undefined || e === null) {
        events.push({ x: x1, type: 0 })
        continue
      }
      const x2 = Math.min(1, e / safeDur)
      if (x2 > x1) {
        events.push({ x: x1, type: 0 })
        events.push({ x: x2, type: 1 })
      }
    } else {
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

  const EVENT_STRIDE = 5
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
