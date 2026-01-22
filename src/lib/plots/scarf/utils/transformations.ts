/**
 * ScarfPlot Data Transformation Utilities
 */

import type { ScarfGridType } from '$lib/workspace/type/gridType'
import type {
  ScarfData,
  ScarfParticipant,
  ScarfStyleItem,
  ScarfStyling,
  ScarfLegendData,
  ScarfLegendGroup,
  ScarfLegendItem,
  ScarfLegendStyleType,
} from '$lib/plots/scarf/types'
import {
  getAois,
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
  createAdaptiveTimeline,
  type AdaptiveTimeline,
} from '$lib/plots/shared'
import {
  IDENTIFIER_IS_AOI,
  IDENTIFIER_IS_OTHER_CATEGORY,
  IDENTIFIER_NOT_DEFINED,
  IDENTIFIER_IS_EVENT,
} from '$lib/plots/scarf/const/identifiers'
import {
  MAX_AOI_PER_STIMULUS,
  SEGMENT_STRIDE,
  SegmentField,
} from '$lib/gaze-data/shared/types'
import type { ExtendedInterpretedDataType } from '$lib/gaze-data/shared/types'
import { SCARF_LAYOUT } from '$lib/plots/scarf/utils/scarfServices'

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
  const { HEIGHT_OF_BAR, SPACE_ABOVE_RECT } = SCARF_LAYOUT
  const rectWrappedHeight = HEIGHT_OF_BAR + SPACE_ABOVE_RECT * 2

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
      identifier: `${IDENTIFIER_IS_AOI}${a.id}`,
      name: a.displayedName,
      color: a.color,
    })
  }
  aoi.push({
    identifier: `${IDENTIFIER_IS_AOI}${IDENTIFIER_NOT_DEFINED}`,
    name: noAoiTreatment.displayedName,
    color: noAoiTreatment.color,
  })

  const category: ScarfStyleItem[] = [
    {
      identifier: `${IDENTIFIER_IS_OTHER_CATEGORY}1`,
      name: 'Saccade',
      color: '#555555',
    },
    {
      identifier: `${IDENTIFIER_IS_OTHER_CATEGORY}${IDENTIFIER_NOT_DEFINED}`,
      name: 'Other',
      color: '#a6a6a6',
    },
  ]

  const visibility: ScarfStyleItem[] = []
  if (showAoiVisibility) {
    for (let i = 0; i < aoiData.length; i++) {
      const a = aoiData[i]
      visibility.push({
        identifier: `${IDENTIFIER_IS_EVENT}${a.id}`,
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
    HEIGHT_OF_BAR,
    NON_FIXATION_HEIGHT,
    SPACE_ABOVE_RECT,
    HEIGHT_OF_X_AXIS,
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
          SPACE_ABOVE_RECT + (HEIGHT_OF_BAR >> 1) - (NON_FIXATION_HEIGHT >> 1)
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
            overlapAoiBuffer[overlapCount++] = aoiId
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
      const internalY = SPACE_ABOVE_RECT + (HEIGHT_OF_BAR >> 1)
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
