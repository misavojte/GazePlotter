import type { DataType } from '$lib/data/types'
import type { ParseSettings, SegmentRow } from '../types'
import { SegmentWriter } from './segmentWriter'

/**
 * One event-channel occurrence contributed by a format — the ingest seam
 * for non-gaze instruments (marker streams, triggers, stimulus events).
 * Lands in `DataType.eventData` keyed by stimulus/participant ORIGINAL
 * names; occurrences referencing names that no segment produced are
 * dropped (same resolution rule as the post-load CSV event merge).
 */
export interface EventContribution {
  stimulus: string
  participant: string
  channel: string
  /** Start time in ms (same time base as the segments). */
  start: number
  /** Duration in ms; 0 marks a discrete/instant event. */
  duration: number
  color?: string
}

/**
 * Typed contributions out — what formats write into. One method per
 * contribution kind; a future continuous-signal kind would be added here
 * (plus its storage in `DataType`), not as a new ingest path.
 */
export interface DatasetSink {
  /**
   * Hot path: emit one segment as raw bytes. This is a PREBOUND function —
   * grab the reference once before a row loop so the per-row call stays
   * monomorphic (mirrors the old `writer.addSegmentBytes.bind(writer)`).
   */
  readonly addSegmentBytes: (
    start: number,
    end: number,
    categoryId: number,
    stimulus: Uint8Array,
    participant: Uint8Array,
    aoi: Uint8Array[] | null,
    spatial?: { x: number; y: number } | null
  ) => void
  /** Slow path: emit one segment as strings (archive formats). */
  addSegment(row: SegmentRow): void
  /** Emit one event-channel occurrence. */
  addEvent(event: EventContribution): void
}

/**
 * The kernel's sink implementation: `SegmentWriter` for segments plus an
 * event accumulator, merged into one `DataType` by `buildFinalData`.
 * The job owns the instance; formats only ever see the `DatasetSink` view.
 */
export class DatasetBuilder implements DatasetSink {
  private readonly writer = new SegmentWriter()
  private readonly events: EventContribution[] = []

  readonly addSegmentBytes = this.writer.addSegmentBytes.bind(this.writer)

  /** Called by the job before each file's read (never by formats). */
  beginFile(
    settings: ParseSettings,
    emptyDatasetError: string | null = null
  ): void {
    this.writer.setEncoding(settings.encoding)
    this.writer.setEmptyDatasetError(emptyDatasetError)
  }

  addSegment(row: SegmentRow): void {
    this.writer.add(row)
  }

  addEvent(event: EventContribution): void {
    this.events.push(event)
  }

  buildFinalData(): DataType {
    const data = this.writer.buildFinalData()
    if (this.events.length > 0) mergeEvents(data, this.events)
    return data
  }
}

/**
 * Folds accumulated event contributions into `DataType.eventData`, using
 * the same layout the engine maintains:
 * `data[stimulusId][channelId] = [originalName, displayedName, color]`,
 * `events[stimulusId][channelId][participantId] = stride-2 [start, duration, …]`.
 */
function mergeEvents(data: DataType, events: EventContribution[]): void {
  const stimulusIdByName = new Map<string, number>()
  data.stimuli.data.forEach((row, i) => stimulusIdByName.set(row[0], i))
  const participantIdByName = new Map<string, number>()
  data.participants.data.forEach((row, i) => participantIdByName.set(row[0], i))

  const stimuliCount = data.stimuli.data.length
  const participantCount = data.participants.data.length

  // channelId lookup per stimulus, keyed by channel name.
  const channelIdByName: Array<Map<string, number>> = Array.from(
    { length: stimuliCount },
    () => new Map()
  )

  const ed = data.eventData
  let anyEvent = false

  for (const event of events) {
    const sId = stimulusIdByName.get(event.stimulus)
    const pId = participantIdByName.get(event.participant)
    if (sId === undefined || pId === undefined) continue

    let chId = channelIdByName[sId].get(event.channel)
    if (chId === undefined) {
      chId = ed.data[sId].length
      channelIdByName[sId].set(event.channel, chId)
      ed.data[sId].push([
        event.channel,
        event.channel,
        event.color ?? '#888888',
      ])
      ed.events[sId].push(
        Array.from({ length: participantCount }, () => [] as number[])
      )
    }
    ed.events[sId][chId][pId].push(event.start, event.duration)
    anyEvent = true
  }

  // Per-stimulus channel order + hidden lists, mirroring the engine's
  // updateEventDataBatch bookkeeping.
  ed.orderVector = Array.from({ length: stimuliCount }, (_, s) =>
    ed.data[s].map((_, i) => i)
  )
  ed.hiddenChannels = Array.from({ length: stimuliCount }, () => [])

  if (anyEvent) data.capabilities.event = true
}
