/**
 * Parser for custom CSV event files.
 *
 * Expected columns: stimulus, participant, eventName, start, duration
 * Delimiter: auto-detected (, vs ;)
 * Participant value "*" applies events to all participants.
 */

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
