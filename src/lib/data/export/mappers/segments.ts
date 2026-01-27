import { type DataType } from '$lib/data/types'
import { BinaryBufferReader } from '$lib/data/types'
import { getAoi, engine } from '$lib/data/engine'
import {
  type CsvFormatOptions,
  resolveCsvFormatOptions,
  generateCsvString,
} from '../encoders/csv'

const SEGMENT_HEADER = [
  'stimulus',
  'participant',
  'timestamp',
  'duration',
  'eyemovementtype',
  'AOI',
]

const BATCH_HEADER = ['timestamp', 'duration', 'eyemovementtype', 'AOI']

/**
 * Converts the complex hierarchical eye-tracking data structure to a flat array format.
 */
function convertDataStructure(data: DataType): Array<{
  stimulus: string
  participant: string
  timestamp: string
  duration: string
  eyemovementtype: string
  AOI: string[] | null
}> {
  const result: Array<{
    stimulus: string
    participant: string
    timestamp: string
    duration: string
    eyemovementtype: string
    AOI: string[] | null
  }> = []

  const reader = new BinaryBufferReader(data.segments)
  const aoiGroupReader = engine.getAoiGroupReader()

  for (
    let stimulusIndex = 0;
    stimulusIndex < data.segments.stimuliCount;
    stimulusIndex++
  ) {
    for (
      let participantIndex = 0;
      participantIndex < data.participants.data.length;
      participantIndex++
    ) {
      reader.forEachSegment(stimulusIndex, participantIndex, segmentIndex => {
        const start = reader.getSegmentStart(segmentIndex)
        const end = reader.getSegmentEnd(segmentIndex)
        const category = reader.getSegmentCategory(segmentIndex)
        const aoiIds = aoiGroupReader
          ? aoiGroupReader.getSegmentAois(segmentIndex, stimulusIndex, true)
          : Array.from(reader.getRawAois(segmentIndex))

        const aoiNames =
          aoiIds.length > 0
            ? aoiIds.map(id => getAoi(stimulusIndex, id).displayedName)
            : null

        result.push({
          stimulus: data.stimuli.data[stimulusIndex][0],
          participant: data.participants.data[participantIndex][0],
          timestamp: String(start),
          duration: String(end - start),
          eyemovementtype: String(category),
          AOI: aoiNames,
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
  options?: CsvFormatOptions
): string {
  const { decimalSeparator } = resolveCsvFormatOptions(options)
  const csvPreData = convertDataStructure(data)

  const rows = csvPreData.map(item => {
    const aoiNames = item.AOI ? item.AOI.join(';') : ''
    return [
      item.stimulus,
      item.participant,
      Number(item.timestamp).toFixed(decimalSeparator === ',' ? 1 : 0),
      Number(item.duration).toFixed(decimalSeparator === ',' ? 1 : 0),
      item.eyemovementtype,
      aoiNames,
    ]
  })

  return generateCsvString(SEGMENT_HEADER, rows, options)
}

/**
 * Generates individual CSV strings for each participant/stimulus combination.
 * Useful for batch exporting results and mapping them to ZIP files.
 */
export function generateMetadataForBatchCsv(
  data: DataType,
  filterFixations: boolean = false,
  options?: CsvFormatOptions
): Array<{ fileName: string; content: string }> {
  const { decimalSeparator } = resolveCsvFormatOptions(options)
  const csvPreData = convertDataStructure(data)

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

      const filteredData = filterFixations
        ? combinedData.filter(item => item.eyemovementtype === '0')
        : combinedData

      if (filteredData.length === 0) continue

      const rows = filteredData.map(item => {
        const aoiNames = item.AOI ? item.AOI.join(';') : ''
        return [
          Number(item.timestamp).toFixed(decimalSeparator === ',' ? 1 : 0),
          Number(item.duration).toFixed(decimalSeparator === ',' ? 1 : 0),
          item.eyemovementtype,
          aoiNames,
        ]
      })

      results.push({
        fileName: `${stimulus}_${participant}`,
        content: generateCsvString(BATCH_HEADER, rows, options),
      })
    }
  }

  return results
}
