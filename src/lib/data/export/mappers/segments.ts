import { type DataType } from '$lib/data/types'
import { AoiGroupReader, BinaryBufferReader, FIXATION_CATEGORY_ID } from '$lib/data/binary'
import { getAoiRaw, getCategoryRaw } from '$lib/data/engine/utils/interpreters'
import type { ExportNaming } from '../types'
import {
  type CsvFormatOptions,
  resolveCsvFormatOptions,
  generateCsvString,
  formatNumberForCsv,
} from '../encoders/csv'

const SEGMENT_HEADER = [
  'stimulus',
  'participant',
  'timestamp',
  'duration',
  'eyemovementtype',
  'AOI',
]

const SEGMENT_HEADER_WITH_SPATIAL = [...SEGMENT_HEADER, 'x', 'y']

const BATCH_HEADER = ['timestamp', 'duration', 'eyemovementtype', 'AOI']

const BATCH_HEADER_WITH_SPATIAL = [...BATCH_HEADER, 'x', 'y']

type SegmentCsvRow = {
  stimulus: string
  participant: string
  timestamp: string
  duration: string
  eyemovementtype: string
  AOI: string[] | null
  x?: string
  y?: string
}

/**
 * Converts the complex hierarchical eye-tracking data structure to a flat array format.
 *
 * `naming` selects how categories and AOIs are named:
 * - 'displayed' (default): the eye movement type and AOIs use their displayed
 *   names, and AOIs are grouped + deduplicated by displayed name (the on-screen
 *   form). Hidden AOIs are excluded.
 * - 'raw': the eye movement type and AOIs use their original imported names, and
 *   every AOI the segment references is listed individually (no grouping, hidden
 *   AOIs included).
 */
function convertDataStructure(
  data: DataType,
  stimulusIds?: Set<string>,
  filterFixations: boolean = false,
  naming: ExportNaming = 'displayed'
): SegmentCsvRow[] {
  const result: SegmentCsvRow[] = []
  const displayed = naming !== 'raw'

  const reader = new BinaryBufferReader(data.segments)
  // Grouping (merge AOIs by displayed name, drop hidden) is a displayed-mode
  // concern only — raw mode reads the segment's stored AOI ids directly.
  const aoiGroupReader = displayed ? new AoiGroupReader(reader) : null
  if (aoiGroupReader) aoiGroupReader.updateMap(data)
  const aoiBuffer = displayed ? new Uint16Array(32) : null

  const categoryName = (categoryId: number): string => {
    if (!data.categories.data[categoryId]) return String(categoryId)
    const category = getCategoryRaw(categoryId, data)
    return displayed ? category.displayedName : category.originalName
  }

  for (
    let stimulusIndex = 0;
    stimulusIndex < data.segments.stimuliCount;
    stimulusIndex++
  ) {
    const stimulusName = displayed
      ? (data.stimuli.data[stimulusIndex][1] ?? data.stimuli.data[stimulusIndex][0])
      : data.stimuli.data[stimulusIndex][0]
    const stimulusId = stimulusIndex.toString() // id is index

    if (stimulusIds && !stimulusIds.has(stimulusId)) continue

    for (
      let participantIndex = 0;
      participantIndex < data.participants.data.length;
      participantIndex++
    ) {
      reader.forEachSegment(stimulusIndex, participantIndex, segmentIndex => {
        const start = reader.getSegmentStart(segmentIndex)
        const end = reader.getSegmentEnd(segmentIndex)
        const category = reader.getSegmentCategory(segmentIndex)

        if (filterFixations && category !== FIXATION_CATEGORY_ID) return

        let aoiNames: string[] | null
        if (aoiGroupReader && aoiBuffer) {
          const aoiCount = aoiGroupReader.getSegmentAoisIntoUniqueTyped(
            segmentIndex,
            stimulusIndex,
            aoiBuffer
          )
          aoiNames =
            aoiCount > 0
              ? Array.from(
                  { length: aoiCount },
                  (_, index) =>
                    getAoiRaw(stimulusIndex, aoiBuffer[index], data)
                      .displayedName
                )
              : null
        } else {
          const rawAois = reader.getRawAois(segmentIndex)
          aoiNames =
            rawAois.length > 0
              ? Array.from(
                  rawAois,
                  id => getAoiRaw(stimulusIndex, id, data).originalName
                )
              : null
        }

        const spatial = reader.getSegmentSpatial(segmentIndex)

        result.push({
          stimulus: stimulusName,
          participant: displayed
            ? (data.participants.data[participantIndex][1] ?? data.participants.data[participantIndex][0])
            : data.participants.data[participantIndex][0],
          timestamp: String(start),
          duration: String(end - start),
          eyemovementtype: categoryName(category),
          AOI: aoiNames,
          ...(spatial
            ? {
                x: String(spatial.x),
                y: String(spatial.y),
              }
            : {}),
        })
      })
    }
  }

  return result
}

/**
 * Generates a unified CSV string for all gaze segments in the dataset.
 */
export function generateUnifiedCsv(
  data: DataType,
  stimulusIds?: Set<string>,
  filterFixations: boolean = false,
  options?: CsvFormatOptions,
  naming: ExportNaming = 'displayed'
): string {
  const { decimalSeparator } = resolveCsvFormatOptions(options)
  const csvPreData = convertDataStructure(
    data,
    stimulusIds,
    filterFixations,
    naming
  )
  const includeSpatialColumns = data.capabilities.spatial

  const rows = csvPreData.map(item => {
    const aoiNames = item.AOI ? item.AOI.join(';') : ''

    if (!includeSpatialColumns) {
      return [
        item.stimulus,
        item.participant,
        formatNumberForCsv(item.timestamp, decimalSeparator),
        formatNumberForCsv(item.duration, decimalSeparator),
        item.eyemovementtype,
        aoiNames,
      ]
    }

    return [
      item.stimulus,
      item.participant,
      formatNumberForCsv(item.timestamp, decimalSeparator),
      formatNumberForCsv(item.duration, decimalSeparator),
      item.eyemovementtype,
      aoiNames,
      formatNumberForCsv(item.x, decimalSeparator),
      formatNumberForCsv(item.y, decimalSeparator),
    ]
  })

  return generateCsvString(
    includeSpatialColumns ? SEGMENT_HEADER_WITH_SPATIAL : SEGMENT_HEADER,
    rows,
    options
  )
}

/**
 * Generates individual CSV strings for each participant/stimulus combination.
 * Useful for batch exporting results and mapping them to ZIP files.
 */
export function generateMetadataForBatchCsv(
  data: DataType,
  stimulusIds?: Set<string>,
  filterFixations: boolean = false,
  options?: CsvFormatOptions,
  naming: ExportNaming = 'displayed'
): Array<{ fileName: string; content: string }> {
  const { decimalSeparator } = resolveCsvFormatOptions(options)
  const csvPreData = convertDataStructure(
    data,
    stimulusIds,
    filterFixations,
    naming
  )
  const includeSpatialColumns = data.capabilities.spatial

  const results: Array<{ fileName: string; content: string }> = []

  const participants = Array.from(
    new Set(csvPreData.map(item => item.participant))
  )
  const stimuli = Array.from(new Set(csvPreData.map(item => item.stimulus)))

  for (const participant of participants) {
    for (const stimulus of stimuli) {
      const combinedData = csvPreData.filter(
        item => item.participant === participant && item.stimulus === stimulus
      )

      if (combinedData.length === 0) continue

      const rows = combinedData.map(item => {
        const aoiNames = item.AOI ? item.AOI.join(';') : ''

        if (!includeSpatialColumns) {
          return [
            formatNumberForCsv(item.timestamp, decimalSeparator),
            formatNumberForCsv(item.duration, decimalSeparator),
            item.eyemovementtype,
            aoiNames,
          ]
        }

        return [
          formatNumberForCsv(item.timestamp, decimalSeparator),
          formatNumberForCsv(item.duration, decimalSeparator),
          item.eyemovementtype,
          aoiNames,
          formatNumberForCsv(item.x, decimalSeparator),
          formatNumberForCsv(item.y, decimalSeparator),
        ]
      })

      results.push({
        fileName: `${stimulus}_${participant}`,
        content: generateCsvString(
          includeSpatialColumns ? BATCH_HEADER_WITH_SPATIAL : BATCH_HEADER,
          rows,
          options
        ),
      })
    }
  }

  return results
}
