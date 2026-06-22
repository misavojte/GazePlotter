/**
 * Custom CSV event files — the 'contributions' enrichment format.
 *
 * Expected columns: stimulus, participant, eventName, start, duration
 * Delimiter: auto-detected (, vs ;)
 * Participant value "*" applies events to all participants.
 *
 * Parsing produces `EventContribution`s (the shared event currency);
 * resolution against a dataset happens later — `mergeEvents` for a
 * dataset being built, `resolveContributionsForEngine` for the live
 * engine (which additionally matches displayed names and inherits AOI
 * colors, both meaningless for a fresh dataset).
 */

import type { EnrichmentFormatDefinition } from '../kernel/format'
import type { EventContribution } from '../kernel/sink'

const REQUIRED_COLUMNS = [
  'stimulus',
  'participant',
  'eventName',
  'start',
  'duration',
] as const

type StimulusMapEntry = {
  def: string[]
  perParticipant: number[][]
}

export type StimulusMap = Map<number, Map<string, StimulusMapEntry>>

/**
 * Detect delimiter (, vs ;) by counting occurrences in the header line.
 */
function detectDelimiter(headerLine: string): string {
  const commas = headerLine.split(',').length
  const semicolons = headerLine.split(';').length
  return commas >= semicolons ? ',' : ';'
}

/** Header sniff shared by the format's `detect` and the parser. */
export function detectCsvEventHeader(headerLine: string): boolean {
  if (!headerLine) return false
  const delimiter = detectDelimiter(headerLine)
  const columns = headerLine.split(delimiter).map(c => c.trim())
  return REQUIRED_COLUMNS.every(col => columns.includes(col))
}

/**
 * Parse raw CSV event text into event contributions.
 */
export function parseCsvEventText(text: string): {
  contributions: EventContribution[]
  warnings: string[]
} {
  const contributions: EventContribution[] = []
  const warnings: string[] = []

  const lines = text.split(/\r?\n/)
  if (lines.length === 0) {
    warnings.push('Empty file')
    return { contributions, warnings }
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
      return { contributions, warnings }
    }
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line === '') continue

    const cells = line.split(delimiter)
    const stimulus = cells[idx.stimulus]?.trim() ?? ''
    const participant = cells[idx.participant]?.trim() ?? ''
    const channel = cells[idx.eventName]?.trim() ?? ''
    const start = Number(cells[idx.start]?.trim())
    const duration = Number(cells[idx.duration]?.trim())

    if (stimulus === '' || channel === '') {
      warnings.push(`Row ${i + 1}: empty stimulus or eventName, skipped`)
      continue
    }
    if (!Number.isFinite(start) || !Number.isFinite(duration)) {
      warnings.push(`Row ${i + 1}: invalid start or duration, skipped`)
      continue
    }

    contributions.push({ stimulus, participant, channel, start, duration })
  }

  return { contributions, warnings }
}

export const csvEventFormat: EnrichmentFormatDefinition = {
  kind: 'enrichment',
  id: 'csv-event',
  displayName: 'CSV events',
  consume: 'contributions',
  detect: probe => detectCsvEventHeader(probe.headerRow),
  parse: parseCsvEventText,
}

/**
 * Resolve contributions against LIVE engine metadata, producing the
 * engine's per-stimulus channel layout. Unlike the kernel's `mergeEvents`
 * (fresh datasets), this matches displayed names too (data may have been
 * renamed) and inherits the color of a same-named AOI.
 */
export function resolveContributionsForEngine(
  contributions: EventContribution[],
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

  for (const contribution of contributions) {
    const stimulusId = stimulusLookup.get(contribution.stimulus)
    if (stimulusId === undefined) {
      warnings.push(
        `Stimulus "${contribution.stimulus}" not found, row skipped`
      )
      continue
    }

    // Resolve participant: "*" means all
    let participantId: number | null = null
    if (contribution.participant !== '*') {
      const pid = participantLookup.get(contribution.participant)
      if (pid === undefined) {
        warnings.push(
          `Participant "${contribution.participant}" not found, row skipped`
        )
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
    if (!channelMap.has(contribution.channel)) {
      let color = contribution.color ?? '#888888'
      const stimAoiData = aoiData?.[stimulusId]
      if (stimAoiData) {
        for (const aoiRow of stimAoiData) {
          if (
            aoiRow[0] === contribution.channel ||
            aoiRow[1] === contribution.channel
          ) {
            color = aoiRow[2] ?? color
            break
          }
        }
      }
      channelMap.set(contribution.channel, {
        def: [contribution.channel, contribution.channel, color],
        perParticipant: Array.from({ length: participantCount }, () => []),
      })
    }

    const entry = channelMap.get(contribution.channel)!

    // Append stride-2 [start, duration] to appropriate participant slots
    if (participantId !== null) {
      entry.perParticipant[participantId].push(
        contribution.start,
        contribution.duration
      )
    } else {
      for (let p = 0; p < participantCount; p++) {
        entry.perParticipant[p].push(contribution.start, contribution.duration)
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

// NOTE: standalone event-only datasets were removed (1.9.0). Event files
// annotate eye-tracking data; they are resolved against a loaded engine via
// `resolveContributionsForEngine`, never built into a dataset on their own.
