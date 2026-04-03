import { type DataType } from '$lib/data/types'
import { AoiGroupReader, BinaryBufferReader } from '$lib/data/binary'
import { getAoiRaw } from '$lib/data/engine/utils/interpreters'
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
 */
function convertDataStructure(
  data: DataType,
  stimulusIds?: Set<string>,
  filterFixations: boolean = false
): SegmentCsvRow[] {
  const result: SegmentCsvRow[] = []

  const reader = new BinaryBufferReader(data.segments)
  const aoiGroupReader = new AoiGroupReader(reader)
  aoiGroupReader.updateMap(data)
  const aoiBuffer = new Uint16Array(32)

  for (
    let stimulusIndex = 0;
    stimulusIndex < data.segments.stimuliCount;
    stimulusIndex++
  ) {
    const stimulusName = data.stimuli.data[stimulusIndex][0]
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

        if (filterFixations && category !== 0) return

        const aoiCount = aoiGroupReader.getSegmentAoisIntoUniqueTyped(
          segmentIndex,
          stimulusIndex,
          aoiBuffer
        )

        const aoiNames =
          aoiCount > 0
            ? Array.from(
                { length: aoiCount },
                (_, index) =>
                  getAoiRaw(stimulusIndex, aoiBuffer[index], data).displayedName
              )
            : null

        const spatial = reader.getSegmentSpatial(segmentIndex)

        result.push({
          stimulus: stimulusName,
          participant: data.participants.data[participantIndex][0],
          timestamp: String(start),
          duration: String(end - start),
          eyemovementtype: String(category),
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
  options?: CsvFormatOptions
): string {
  const { decimalSeparator } = resolveCsvFormatOptions(options)
  const csvPreData = convertDataStructure(data, stimulusIds, filterFixations)
  const includeSpatialColumns = data.segments.hasSpatialData

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
  options?: CsvFormatOptions
): Array<{ fileName: string; content: string }> {
  const { decimalSeparator } = resolveCsvFormatOptions(options)
  const csvPreData = convertDataStructure(data, stimulusIds, filterFixations)
  const includeSpatialColumns = data.segments.hasSpatialData

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
