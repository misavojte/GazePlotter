/**
 * Parser for custom CSV event files.
 *
 * Expected columns: stimulus, participant, eventName, start, duration
 * Delimiter: auto-detected (, vs ;)
 * Participant value "*" applies events to all participants.
 */

import type { DataType } from '$lib/data/types'
import { DEFAULT_NO_AOI_TREATMENT } from '$lib/data/types'
import { createSystemMetricInstances } from '$lib/plots/metrics/instances'

const REQUIRED_COLUMNS = [
  'stimulus',
  'participant',
  'eventName',
  'start',
  'duration',
] as const

type CsvEventRow = {
  stimulus: string
  participant: string
  eventName: string
  start: number
  duration: number
}

type CsvEventParseResult = {
  rows: CsvEventRow[]
  warnings: string[]
}

type StimulusMapEntry = {
  def: string[]
  perParticipant: number[][]
}

type StimulusMap = Map<number, Map<string, StimulusMapEntry>>

/**
 * Detect whether a file is a CSV event file by checking the header
 * for all required columns. Reads only the first 1024 bytes.
 */
export async function isCsvEventFile(file: File): Promise<boolean> {
  const slice = await file.slice(0, 1024).text()
  const headerLine = slice.split(/\r?\n/)[0]
  if (!headerLine) return false
  const delimiter = detectDelimiter(headerLine)
  const columns = headerLine.split(delimiter).map(c => c.trim())
  return REQUIRED_COLUMNS.every(col => columns.includes(col))
}

/**
 * Detect delimiter (, vs ;) by counting occurrences in the header line.
 */
function detectDelimiter(headerLine: string): string {
  const commas = headerLine.split(',').length
  const semicolons = headerLine.split(';').length
  return commas >= semicolons ? ',' : ';'
}

/**
 * Parse raw CSV event text into structured rows.
 */
export function parseCsvEventText(text: string): CsvEventParseResult {
  const rows: CsvEventRow[] = []
  const warnings: string[] = []

  const lines = text.split(/\r?\n/)
  if (lines.length === 0) {
    warnings.push('Empty file')
    return { rows, warnings }
  }

  const headerLine = lines[0]
  const delimiter = detectDelimiter(headerLine)
  const headers = headerLine.split(delimiter).map(c => c.trim())

  const idx = {
    stimulus: headers.indexOf('stimulus'),
    participant: headers.indexOf('participant'),
    eventName: headers.indexOf('eventName'),
    start: headers.indexOf('start'),
    duration: headers.indexOf('duration'),
  }

  for (const col of REQUIRED_COLUMNS) {
    if (idx[col] === -1) {
      warnings.push(`Missing required column: ${col}`)
      return { rows, warnings }
    }
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line === '') continue

    const cells = line.split(delimiter)
    const stimulus = cells[idx.stimulus]?.trim() ?? ''
    const participant = cells[idx.participant]?.trim() ?? ''
    const eventName = cells[idx.eventName]?.trim() ?? ''
    const start = Number(cells[idx.start]?.trim())
    const duration = Number(cells[idx.duration]?.trim())

    if (stimulus === '' || eventName === '') {
      warnings.push(`Row ${i + 1}: empty stimulus or eventName, skipped`)
      continue
    }
    if (!Number.isFinite(start) || !Number.isFinite(duration)) {
      warnings.push(`Row ${i + 1}: invalid start or duration, skipped`)
      continue
    }

    rows.push({ stimulus, participant, eventName, start, duration })
  }

  return { rows, warnings }
}

/**
 * Resolve parsed CSV event rows against loaded engine metadata.
 * Produces stimulus map entries compatible with the XML/JSON event path.
 */
export function buildEventDataFromCsvRows(
  rows: CsvEventRow[],
  stimuliData: string[][],
  participantsData: string[][],
  participantCount: number,
  aoiData?: string[][][]
): { stimulusMap: StimulusMap; warnings: string[] } {
  const warnings: string[] = []

  // Build name→id lookup maps (check both original [0] and displayed [1] names)
  const stimulusLookup = new Map<string, number>()
  for (let i = 0; i < stimuliData.length; i++) {
    stimulusLookup.set(stimuliData[i][0], i)
    if (stimuliData[i][1]) stimulusLookup.set(stimuliData[i][1], i)
  }

  const participantLookup = new Map<string, number>()
  for (let i = 0; i < participantsData.length; i++) {
    participantLookup.set(participantsData[i][0], i)
    if (participantsData[i][1]) participantLookup.set(participantsData[i][1], i)
  }

  const stimulusMap: StimulusMap = new Map()

  for (const row of rows) {
    const stimulusId = stimulusLookup.get(row.stimulus)
    if (stimulusId === undefined) {
      warnings.push(`Stimulus "${row.stimulus}" not found, row skipped`)
      continue
    }

    // Resolve participant: "*" means all
    let participantId: number | null = null
    if (row.participant !== '*') {
      const pid = participantLookup.get(row.participant)
      if (pid === undefined) {
        warnings.push(`Participant "${row.participant}" not found, row skipped`)
        continue
      }
      participantId = pid
    }

    // Get or create stimulus entry
    if (!stimulusMap.has(stimulusId)) {
      stimulusMap.set(stimulusId, new Map())
    }
    const channelMap = stimulusMap.get(stimulusId)!

    // Get or create channel entry
    if (!channelMap.has(row.eventName)) {
      let color = '#888888'
      const stimAoiData = aoiData?.[stimulusId]
      if (stimAoiData) {
        for (const aoiRow of stimAoiData) {
          if (aoiRow[0] === row.eventName || aoiRow[1] === row.eventName) {
            color = aoiRow[2] ?? color
            break
          }
        }
      }
      channelMap.set(row.eventName, {
        def: [row.eventName, row.eventName, color],
        perParticipant: Array.from({ length: participantCount }, () => []),
      })
    }

    const entry = channelMap.get(row.eventName)!

    // Append stride-2 [start, duration] to appropriate participant slots
    if (participantId !== null) {
      entry.perParticipant[participantId].push(row.start, row.duration)
    } else {
      for (let p = 0; p < participantCount; p++) {
        entry.perParticipant[p].push(row.start, row.duration)
      }
    }
  }

  return { stimulusMap, warnings }
}

/**
 * Merge source stimulus map into target (concatenating per-participant buffers).
 */
export function mergeIntoStimulusMap(
  target: StimulusMap,
  source: StimulusMap
): void {
  for (const [stimulusId, sourceChannelMap] of source) {
    if (!target.has(stimulusId)) {
      target.set(stimulusId, sourceChannelMap)
      continue
    }
    const targetChannelMap = target.get(stimulusId)!
    for (const [channelName, sourceEntry] of sourceChannelMap) {
      const existing = targetChannelMap.get(channelName)
      if (!existing) {
        targetChannelMap.set(channelName, sourceEntry)
      } else {
        for (let p = 0; p < sourceEntry.perParticipant.length; p++) {
          if (sourceEntry.perParticipant[p].length > 0) {
            if (existing.perParticipant[p].length > 0) {
              existing.perParticipant[p] = [
                ...existing.perParticipant[p],
                ...sourceEntry.perParticipant[p],
              ]
            } else {
              existing.perParticipant[p] = sourceEntry.perParticipant[p]
            }
          }
        }
      }
    }
  }
}

/**
 * Build a complete DataType from CSV event rows alone (no gaze data).
 * Extracts stimuli and participants from the CSV content itself.
 */
export function buildDataTypeFromCsvEvents(
  rows: CsvEventRow[]
): { data: DataType; warnings: string[] } {
  const warnings: string[] = []

  // Extract unique stimulus names (insertion order)
  const stimulusNames = [...new Set(rows.map(r => r.stimulus))]
  const stimuliData: string[][] = stimulusNames.map(name => [name, name])

  // Extract unique participant names, excluding "*"
  const participantNames = [
    ...new Set(rows.map(r => r.participant).filter(p => p !== '*')),
  ]
  if (participantNames.length === 0) {
    participantNames.push('Participant')
    warnings.push(
      'All rows use wildcard participant "*". Created a default participant.'
    )
  }
  const participantsData: string[][] = participantNames.map(name => [
    name,
    name,
  ])

  const stimuliCount = stimuliData.length
  const participantCount = participantsData.length

  // Resolve events using existing logic
  const { stimulusMap, warnings: resolveWarnings } = buildEventDataFromCsvRows(
    rows,
    stimuliData,
    participantsData,
    participantCount
  )
  warnings.push(...resolveWarnings)

  // Convert stimulus map to EventDataType arrays
  const eventDataArr: string[][][] = []
  const eventOrderVector: number[][] = []
  const eventHiddenChannels: number[][] = []
  const eventEvents: number[][][][] = []

  for (let s = 0; s < stimuliCount; s++) {
    const channelMap = stimulusMap.get(s)
    if (!channelMap || channelMap.size === 0) {
      eventDataArr.push([])
      eventOrderVector.push([])
      eventHiddenChannels.push([])
      eventEvents.push([])
      continue
    }

    const channelDefs: string[][] = []
    const channelBuffers: number[][][] = []
    for (const { def, perParticipant } of channelMap.values()) {
      channelDefs.push(def)
      channelBuffers.push(perParticipant)
    }

    eventDataArr.push(channelDefs)
    eventOrderVector.push(channelDefs.map((_, i) => i))
    eventHiddenChannels.push([])
    eventEvents.push(channelBuffers)
  }

  const hasAnyEvents = eventEvents.some(stim =>
    stim.some(ch => ch.some(buf => buf.length > 0))
  )

  const data: DataType = {
    isOrdinalOnly: false,
    capabilities: {
      segmented: false,
      spatial: false,
      event: hasAnyEvents,
    },
    stimuli: {
      data: stimuliData,
      orderVector: stimuliData.map((_, i) => i),
    },
    participants: {
      data: participantsData,
      orderVector: participantsData.map((_, i) => i),
    },
    participantsGroups: [],
    metricInstances: createSystemMetricInstances(),
    categories: { data: [], orderVector: [] },
    noAoiTreatment: DEFAULT_NO_AOI_TREATMENT,
    aois: {
      data: Array.from({ length: stimuliCount }, () => []),
      orderVector: Array.from({ length: stimuliCount }, () => []),
      hiddenAois: Array.from({ length: stimuliCount }, () => []),
    },
    segments: {
      segmentBuffer: new Float32Array(0),
      indexTable: new Uint32Array(stimuliCount * participantCount * 2),
      aoiPool: new Uint16Array(0),
      hasSpatialData: false,
      maxParticipants: participantCount,
      stimuliCount,
    },
    eventData: {
      data: eventDataArr,
      orderVector: eventOrderVector,
      hiddenChannels: eventHiddenChannels,
      events: eventEvents,
    },
  }

  return { data, warnings }
}
