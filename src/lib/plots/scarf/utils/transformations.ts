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
} from '$lib/plots/scarf/const/identifiers'
import {
  MAX_AOI_PER_STIMULUS,
  SEGMENT_STRIDE,
  SegmentField,
} from '$lib/gaze-data/shared/types'
import type { ExtendedInterpretedDataType } from '$lib/gaze-data/shared/types'
import { SCARF_LAYOUT } from '$lib/plots/scarf/utils/scarfServices'

const RECT_STRIDE = 8
const LINE_STRIDE = 6

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

  pushLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    participantId: number,
    internalY: number
  ) {
    this.ensureCapacity(LINE_STRIDE)

    const idx = this.writeIndex
    const b = this.buffer

    b[idx] = x1
    b[idx + 1] = y1
    b[idx + 2] = x2
    b[idx + 3] = y2
    b[idx + 4] = participantId
    b[idx + 5] = internalY

    this.writeIndex += LINE_STRIDE
  }

  finalize(): Float32Array {
    return this.buffer.slice(0, this.writeIndex)
  }
}

/**
 * Calculates the participant bar height based on configuration parameters
 */
export function getScarfParticipantBarHeight(
  aoiCount: number,
  showAoiVisibility: boolean
): number {
  const { HEIGHT_OF_BAR, SPACE_ABOVE_RECT, LINE_WRAPPED_HEIGHT } = SCARF_LAYOUT
  const rectWrappedHeight = HEIGHT_OF_BAR + SPACE_ABOVE_RECT * 2

  if (!showAoiVisibility) {
    return rectWrappedHeight
  }

  return rectWrappedHeight + aoiCount * LINE_WRAPPED_HEIGHT
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

  let minValue = 0
  let maxValue = 0

  if (settings.timeline === 'absolute') {
    const stimulusSpecificLimits = settings.absoluteStimuliLimits?.[stimulusId]
    if (
      Array.isArray(stimulusSpecificLimits) &&
      stimulusSpecificLimits.length === 2
    ) {
      ;[minValue, maxValue] = stimulusSpecificLimits
    }
  } else {
    const stimulusSpecificLimits = settings.ordinalStimuliLimits?.[stimulusId]
    if (
      Array.isArray(stimulusSpecificLimits) &&
      stimulusSpecificLimits.length === 2
    ) {
      ;[minValue, maxValue] = stimulusSpecificLimits
    }
  }

  minValue = Math.max(0, minValue)

  if (maxValue === 0) {
    for (const participantId of participantIds) {
      const numberOfSegments = getNumberOfSegments(stimulusId, participantId)
      if (numberOfSegments === 0) continue

      if (settings.timeline === 'ordinal') {
        if (numberOfSegments > maxValue) maxValue = numberOfSegments
      } else {
        const endTime = getParticipantEndTime(stimulusId, participantId)
        if (endTime > maxValue) maxValue = endTime
      }
    }
  }

  if (maxValue <= minValue) {
    maxValue = minValue + (settings.timeline === 'ordinal' ? 10 : 1000)
  }

  return { minValue, maxValue }
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
  const aoiStyling: ScarfStyleItem[] = aoiData.map(aoi => ({
    identifier: `${IDENTIFIER_IS_AOI}${aoi.id}`,
    name: aoi.displayedName,
    color: aoi.color,
  }))

  aoiStyling.push({
    identifier: `${IDENTIFIER_IS_AOI}${IDENTIFIER_NOT_DEFINED}`,
    name: noAoiTreatment.displayedName,
    color: noAoiTreatment.color,
  })

  const categoryStyling: ScarfStyleItem[] = [
    {
      identifier: `${IDENTIFIER_IS_OTHER_CATEGORY}${1}`,
      name: 'Saccade',
      color: '#555555',
    },
    {
      identifier: `${IDENTIFIER_IS_OTHER_CATEGORY}${IDENTIFIER_NOT_DEFINED}`,
      name: 'Other',
      color: '#a6a6a6',
    },
  ]

  const visibilityStyling: ScarfStyleItem[] = !showAoiVisibility
    ? []
    : aoiData.map(aoi => ({
        identifier: `${IDENTIFIER_IS_AOI}${aoi.id}`,
        name: aoi.displayedName,
        color: aoi.color,
      }))

  return {
    visibility: visibilityStyling,
    aoi: aoiStyling,
    category: categoryStyling,
  }
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
export function createScarfLegendData(styling: ScarfStyling): ScarfLegendData {
  const groups: ScarfLegendGroup[] = []

  // AOI group (Fixations) - Full-height rectangles
  if (styling.aoi.length > 0) {
    groups.push({
      title: 'Fixations',
      items: styling.aoi.map(
        (item): ScarfLegendItem => ({
          identifier: item.identifier,
          name: item.name,
          color: item.color,
          styleType: 'fixation',
        })
      ),
    })
  }

  // Category group (Non-fixations) - Thin rectangles
  if (styling.category.length > 0) {
    groups.push({
      title: 'Non-fixations',
      items: styling.category.map(
        (item): ScarfLegendItem => ({
          identifier: item.identifier,
          name: item.name,
          color: item.color,
          styleType: 'nonFixation',
        })
      ),
    })
  }

  // Visibility group (AOI Visibility) - Dashed lines
  if (styling.visibility.length > 0) {
    groups.push({
      title: 'AOI Visibility',
      items: styling.visibility.map(
        (item): ScarfLegendItem => ({
          identifier: item.identifier,
          name: item.name,
          color: item.color,
          styleType: 'visibility',
        })
      ),
    })
  }

  return { groups }
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
    LINE_WRAPPED_HEIGHT,
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

  const stimuli = stimuliData.map(s => ({ id: s.id, name: s.displayedName }))

  // Style mapping
  const aoiStyleCount = stylingAndLegend.aoi.length
  const categoryStyleCount = stylingAndLegend.category.length
  const visibilityStyleCount = stylingAndLegend.visibility.length

  const aoiOrderIndex = new Int16Array(MAX_AOI_PER_STIMULUS)
  aoiOrderIndex.fill(-1)
  for (let i = 0; i < aoiData.length; i++) {
    const id = aoiData[i].id
    if (id >= 0 && id < MAX_AOI_PER_STIMULUS) aoiOrderIndex[id] = i
  }

  const noAoiStyleIdx = aoiData.length
  const saccadeStyleIdx = aoiStyleCount
  const otherCategoryStyleIdx = aoiStyleCount + 1
  const visibilityBaseStyleIdx = aoiStyleCount + categoryStyleCount

  const totalStyleCount =
    aoiStyleCount + categoryStyleCount + visibilityStyleCount
  const rectBucketBuilders = Array.from(
    { length: totalStyleCount },
    () => new Float32GrowBuffer(1024)
  )
  const lineBucketBuilders = Array.from(
    { length: totalStyleCount },
    () => new Float32GrowBuffer(512)
  )

  const isOrdinal = settings.timeline === 'ordinal'
  const isRelative = settings.timeline === 'relative'

  const currentData = getData()
  const { segmentBuffer, indexTable, aoiPool, maxParticipants } =
    currentData.segments

  const hiddenRaw = getHiddenAois(stimulusId)
  const hiddenFlag = new Uint8Array(MAX_AOI_PER_STIMULUS)
  for (const id of hiddenRaw) {
    if (id >= 0 && id < MAX_AOI_PER_STIMULUS) hiddenFlag[id] = 1
  }

  const presentList: number[] = []
  const participants: ScarfParticipant[] = []

  for (let pIndex = 0; pIndex < participantIds.length; pIndex++) {
    const participantId = participantIds[pIndex]
    const sessionDuration = getParticipantEndTime(stimulusId, participantId)
    const rectWrappedHeight = HEIGHT_OF_BAR + SPACE_ABOVE_RECT * 2

    const rangeIdx = (stimulusId * maxParticipants + participantId) * 2
    const startIndex = indexTable[rangeIdx]
    const endIndex = indexTable[rangeIdx + 1]
    const segmentCount = endIndex - startIndex

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

      let x: number, width: number
      if (isRelative) {
        const safeDur = sessionDuration > 0 ? sessionDuration : 1
        x = start / safeDur
        width = (end - start) / safeDur
      } else {
        x = (start - minValue) / visibleRange
        width = (end - start) / visibleRange
      }

      if (categoryId !== 0) {
        const internalY =
          SPACE_ABOVE_RECT + (HEIGHT_OF_BAR >> 1) - (NON_FIXATION_HEIGHT >> 1)
        const styleIdx =
          categoryId === 1 ? saccadeStyleIdx : otherCategoryStyleIdx
        rectBucketBuilders[styleIdx].pushRect(
          x,
          pIndex,
          width,
          NON_FIXATION_HEIGHT,
          participantId,
          localId,
          localId,
          internalY
        )
      } else {
        const pStart = segmentBuffer[base + SegmentField.AOI_POINTER] | 0
        const pCount = segmentBuffer[base + SegmentField.AOI_COUNT] | 0

        presentList.length = 0
        for (let i = 0; i < pCount; i++) {
          const aoiId = aoiPool[pStart + i]
          if (
            aoiId >= 0 &&
            aoiId < MAX_AOI_PER_STIMULUS &&
            hiddenFlag[aoiId] === 0
          ) {
            presentList.push(aoiId)
          }
        }

        if (presentList.length === 0) {
          rectBucketBuilders[noAoiStyleIdx].pushRect(
            x,
            pIndex,
            width,
            HEIGHT_OF_BAR,
            participantId,
            localId,
            localId,
            SPACE_ABOVE_RECT
          )
        } else {
          const h = HEIGHT_OF_BAR / presentList.length
          for (let i = 0; i < presentList.length; i++) {
            rectBucketBuilders[aoiOrderIndex[presentList[i]]].pushRect(
              x,
              pIndex,
              width,
              h,
              participantId,
              localId,
              localId,
              SPACE_ABOVE_RECT + i * h
            )
          }
        }
      }
    }

    if (showAoiVisibility) {
      for (let aoiIdx = 0; aoiIdx < aoiData.length; aoiIdx++) {
        const visibility = getAoiVisibility(
          stimulusId,
          aoiData[aoiIdx].id,
          participantId
        )
        if (!visibility) continue
        const internalY = rectWrappedHeight + aoiIdx * LINE_WRAPPED_HEIGHT
        const styleIdx = visibilityBaseStyleIdx + aoiIdx

        for (let i = 0; i < visibility.length; i += 2) {
          let s = visibility[i]
          let e = visibility[i + 1]

          if (isRelative) {
            const safeDur = sessionDuration > 0 ? sessionDuration : 1
            const x1 = Math.max(0, s / safeDur)
            const x2 = Math.min(1, e / safeDur)
            if (x2 > x1)
              lineBucketBuilders[styleIdx].pushLine(
                x1,
                pIndex,
                x2,
                pIndex,
                participantId,
                internalY
              )
          } else {
            if (e <= minValue || s >= maxValue) continue
            const x1 = (Math.max(minValue, s) - minValue) / visibleRange
            const x2 = (Math.min(maxValue, e) - minValue) / visibleRange
            if (x2 > x1)
              lineBucketBuilders[styleIdx].pushLine(
                x1,
                pIndex,
                x2,
                pIndex,
                participantId,
                internalY
              )
          }
        }
      }
    }

    participants.push({
      id: participantId,
      label: getParticipant(participantId).displayedName,
      width: 0,
    })
  }

  return {
    id: stimulusId,
    timelineType: settings.timeline,
    barHeight: HEIGHT_OF_BAR,
    stimulusId,
    heightOfBarWrap: barWrapHeight,
    chartHeight: participantIds.length * barWrapHeight + HEIGHT_OF_X_AXIS,
    stimuli,
    participants,
    timeline,
    stylingAndLegend,
    legendData: createScarfLegendData(stylingAndLegend),
    leftLabelWidth: 0,
    plotAreaWidth: 0,
    visualRectBuckets: rectBucketBuilders.map(b => b.finalize()),
    visualLineBuckets: lineBucketBuilders.map(b => b.finalize()),
  }
}
