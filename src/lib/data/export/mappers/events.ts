import { type DataType, type ExtendedInterpretedDataType } from '$lib/data/types'
import { EventBufferReader, EVENT_STRIDE } from '$lib/data/binary'
import { groupByDisplayedName } from '$lib/data/engine/utils/grouping'
import { INTERVAL_CHANNEL_MARKER } from '$lib/data/engine/eventIntervals'
import type { ExportNaming } from '../types'
import {
  type CsvFormatOptions,
  resolveCsvFormatOptions,
  generateCsvString,
  formatNumberForCsv,
} from '../encoders/csv'

// `eventName` (not `event`) is the channel column the CSV event-enrichment
// importer requires, so a unified export re-imports as an event file.
const EVENT_HEADER = ['stimulus', 'participant', 'eventName', 'start', 'duration']

const EVENT_BATCH_HEADER = ['eventName', 'start', 'duration']

type EventCsvRow = {
  stimulus: string
  participant: string
  event: string
  start: number
  duration: number
}

/**
 * One exported event channel: a display label and the underlying channel ids
 * whose occurrences feed it. In displayed mode several imported channels can
 * merge into one (same displayed name), so `memberIds` may hold more than one.
 */
type ResolvedEventChannel = { name: string; memberIds: number[] }

/**
 * Resolves the event channels to export for one stimulus.
 *
 * - 'displayed' (default): visible channels (hidden excluded) in display order,
 *   grouped + merged by displayed name, labelled by displayed name. Derived
 *   interval channels are included (they are part of the on-screen result).
 * - 'raw': every imported channel in storage order, including hidden ones,
 *   labelled by original name, never grouped. Derived interval channels are
 *   excluded (they are a display-time derivation, not imported data).
 */
function resolveEventChannels(
  data: DataType,
  stimulusIndex: number,
  displayed: boolean
): ResolvedEventChannel[] {
  const defs = data.eventData.data[stimulusIndex]
  if (!defs || defs.length === 0) return []

  if (!displayed) {
    const channels: ResolvedEventChannel[] = []
    for (let id = 0; id < defs.length; id++) {
      const def = defs[id]
      if (!def) continue
      if (def[3] === INTERVAL_CHANNEL_MARKER) continue
      channels.push({ name: def[0] ?? '', memberIds: [id] })
    }
    return channels
  }

  const order = data.eventData.orderVector?.[stimulusIndex]
  const ids =
    order && order.length > 0
      ? order
      : Array.from({ length: defs.length }, (_, i) => i)
  const hidden = data.eventData.hiddenChannels?.[stimulusIndex] ?? []
  const hiddenSet = hidden.length ? new Set<number>(hidden) : null

  const channels: ExtendedInterpretedDataType[] = []
  for (const id of ids) {
    if (hiddenSet?.has(id)) continue
    const def = defs[id]
    if (!def) continue
    channels.push({
      id,
      originalName: def[0] ?? '',
      displayedName: def[1] ?? def[0] ?? '',
      color: def[2] ?? '#888888',
    })
  }

  // Label by the resolved displayed name exactly as the scarf legend and the
  // AOI/category exporters do (def[1] ?? def[0] ?? ''): an explicitly cleared
  // displayed name stays empty rather than falling back to the original.
  return groupByDisplayedName(channels).map(group => ({
    name: group.displayedName,
    memberIds: group.memberIds,
  }))
}

/**
 * Flattens the binary event occurrence store into one row per occurrence,
 * ordered stimulus -> participant -> start time (mirroring the segment export's
 * per-participant timeline ordering).
 */
function convertEventData(
  data: DataType,
  stimulusIds?: Set<string>,
  naming: ExportNaming = 'displayed'
): EventCsvRow[] {
  const result: EventCsvRow[] = []
  const displayed = naming !== 'raw'

  const reader = new EventBufferReader()
  reader.load(data.eventData.events)

  const participantCount = data.participants.data.length

  for (
    let stimulusIndex = 0;
    stimulusIndex < data.stimuli.data.length;
    stimulusIndex++
  ) {
    const stimulusId = stimulusIndex.toString() // id is index
    if (stimulusIds && !stimulusIds.has(stimulusId)) continue

    const channels = resolveEventChannels(data, stimulusIndex, displayed)
    if (channels.length === 0) continue

    const stimulusName = data.stimuli.data[stimulusIndex][0]

    for (
      let participantIndex = 0;
      participantIndex < participantCount;
      participantIndex++
    ) {
      const occurrences: { event: string; start: number; duration: number }[] =
        []

      for (const channel of channels) {
        for (const memberId of channel.memberIds) {
          const buffer = reader.getOccurrences(
            stimulusIndex,
            memberId,
            participantIndex
          )
          for (let i = 0; i < buffer.length; i += EVENT_STRIDE) {
            occurrences.push({
              event: channel.name,
              start: buffer[i],
              duration: buffer[i + 1],
            })
          }
        }
      }

      if (occurrences.length === 0) continue

      occurrences.sort(
        (a, b) => a.start - b.start || a.event.localeCompare(b.event)
      )

      const participantName = data.participants.data[participantIndex][0]
      for (const occurrence of occurrences) {
        result.push({
          stimulus: stimulusName,
          participant: participantName,
          event: occurrence.event,
          start: occurrence.start,
          duration: occurrence.duration,
        })
      }
    }
  }

  return result
}

/**
 * Generates a single unified CSV string for all event occurrences in the dataset.
 */
export function generateEventUnifiedCsv(
  data: DataType,
  stimulusIds?: Set<string>,
  options?: CsvFormatOptions,
  naming: ExportNaming = 'displayed'
): string {
  const { decimalSeparator } = resolveCsvFormatOptions(options)
  const rows = convertEventData(data, stimulusIds, naming).map(item => [
    item.stimulus,
    item.participant,
    item.event,
    formatNumberForCsv(item.start, decimalSeparator),
    formatNumberForCsv(item.duration, decimalSeparator),
  ])

  return generateCsvString(EVENT_HEADER, rows, options)
}

/**
 * Generates individual CSV strings for each participant/stimulus combination,
 * for batch (ZIP) export.
 */
export function generateEventBatchCsv(
  data: DataType,
  stimulusIds?: Set<string>,
  options?: CsvFormatOptions,
  naming: ExportNaming = 'displayed'
): Array<{ fileName: string; content: string }> {
  const { decimalSeparator } = resolveCsvFormatOptions(options)
  const csvPreData = convertEventData(data, stimulusIds, naming)

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

      const rows = combinedData.map(item => [
        item.event,
        formatNumberForCsv(item.start, decimalSeparator),
        formatNumberForCsv(item.duration, decimalSeparator),
      ])

      results.push({
        fileName: `${stimulus}_${participant}`,
        content: generateCsvString(EVENT_BATCH_HEADER, rows, options),
      })
    }
  }

  return results
}
