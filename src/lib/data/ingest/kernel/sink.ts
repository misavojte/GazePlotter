import type { DataType, DatasetExclusionIssue, DatasetExclusionNotice } from '$lib/data/types'
import type { ParseSettings, SegmentRow } from '../types'
import { SegmentWriter } from './segmentWriter'

/**
 * One event-channel occurrence contributed by a format — the ingest seam
 * for non-gaze instruments (marker streams, triggers, stimulus events).
 * Lands in `DataType.eventData` keyed by stimulus/participant ORIGINAL
 * names; occurrences referencing names that no segment produced are
 * dropped and reported as warnings.
 */
export interface EventContribution {
  stimulus: string
  /** Participant ORIGINAL name, or '*' to apply to every participant. */
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
  /**
   * Intern an eye-movement-category NAME (decoded string) and return its stable
   * id (Fixation reserved at 0). Parsers resolve each segment's category through
   * this so the dataset's `categories.data` reflects the types actually present,
   * with their real names. Keyed on the string so identity is encoding-stable
   * across multi-file uploads. PREBOUND, like `addSegmentBytes`.
   */
  readonly internCategory: (name: string) => number
  /** Slow path: emit one segment as strings (archive formats). */
  addSegment(row: SegmentRow): void
  /** Emit one event-channel occurrence. */
  addEvent(event: EventContribution): void
  /** Report a non-fatal issue (surfaced as a toast after the upload). */
  addWarning(message: string): void
  /**
   * Open a (stimulus, participant) group as PROVISIONAL and return a stable
   * handle. Segments written under these exact byte keys are held back from the
   * dataset until `commitProvisionalGroup(handle)` confirms the group valid; an
   * unconfirmed group is dropped at finalize. A gating format (Tobii interval
   * mode) calls this for every interval group it emits, then commits only the
   * groups whose markers validate — invalid or never-validated data therefore
   * never reaches the writer's output. COLD PATH (once per group, not per row).
   */
  beginProvisionalGroup(stimulus: Uint8Array, participant: Uint8Array): number
  /** Confirm a provisional group valid so its segments are materialized. */
  commitProvisionalGroup(handle: number): void
  /** Reject a provisional group: its segments are discarded. */
  dropProvisionalGroup(handle: number): void
  /**
   * Record a persisted exclusion notice (decoded names + the pairing issues
   * behind the drop). Surfaced as a post-upload toast and in the metadata view.
   * Independent of dropping — a group with no emitted segments can still warrant
   * a notice.
   */
  recordExclusion(
    stimulus: string,
    participant: string,
    issues: DatasetExclusionIssue[]
  ): void
}

/**
 * The kernel's sink implementation: `SegmentWriter` for segments plus an
 * event accumulator, merged into one `DataType` by `buildFinalData`.
 * The job owns the instance; formats only ever see the `DatasetSink` view.
 */
export class DatasetBuilder implements DatasetSink {
  private readonly writer = new SegmentWriter()
  private readonly events: EventContribution[] = []
  private readonly exclusions: DatasetExclusionNotice[] = []

  /** Resolution warnings produced by `buildFinalData` (read by the job). */
  readonly warnings: string[] = []

  readonly addSegmentBytes = this.writer.addSegmentBytes.bind(this.writer)
  readonly internCategory = this.writer.internCategory.bind(this.writer)

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

  addWarning(message: string): void {
    this.warnings.push(message)
  }

  beginProvisionalGroup(stimulus: Uint8Array, participant: Uint8Array): number {
    return this.writer.beginProvisionalGroup(stimulus, participant)
  }

  commitProvisionalGroup(handle: number): void {
    this.writer.commitProvisionalGroup(handle)
  }

  dropProvisionalGroup(handle: number): void {
    this.writer.dropProvisionalGroup(handle)
  }

  recordExclusion(
    stimulus: string,
    participant: string,
    issues: DatasetExclusionIssue[]
  ): void {
    this.exclusions.push({ stimulus, participant, issues })
  }

  buildFinalData(): DataType {
    const data = this.writer.buildFinalData()
    // Events for an excluded (stimulus, participant) group are dropped too:
    // the group was excluded because its stimulus extent is invalid, so events
    // timed against it are meaningless. `'*'` (all-participant) events carry no
    // specific participant and are never matched by an exclusion key.
    const excludedKeys = new Set(
      this.exclusions.map(e => `${e.stimulus} ${e.participant}`)
    )
    let events = this.events
    if (excludedKeys.size > 0) {
      const kept = this.events.filter(
        e => !excludedKeys.has(`${e.stimulus} ${e.participant}`)
      )
      // Surface this drop: segment exclusion is reported to the user, so the
      // event occurrences discarded with those groups must be counted too,
      // not dropped silently (parity with mergeEvents' unknown-name accounting).
      const dropped = this.events.length - kept.length
      if (dropped > 0) {
        this.warnings.push(
          `${dropped} event(s) belonged to excluded interval group(s) and were dropped`
        )
      }
      events = kept
    }
    if (events.length > 0) {
      this.warnings.push(...mergeEvents(data, events))
    }
    if (this.exclusions.length > 0) {
      data.dataExclusions = this.exclusions
    }
    return data
  }
}

/**
 * Folds accumulated event contributions into `DataType.eventData`, using
 * the same layout the engine maintains:
 * `data[stimulusId][channelId] = [originalName, displayedName, color]`,
 * `events[stimulusId][channelId][participantId] = stride-2 [start, duration, …]`.
 *
 * `participant: '*'` applies the occurrence to every participant.
 * Contributions referencing unknown stimulus/participant names are dropped;
 * the returned warnings aggregate the drops per unknown name.
 *
 * Exported as THE event resolution rule — the post-load enrichment flows
 * reuse it instead of maintaining a parallel implementation.
 */
export function mergeEvents(
  data: DataType,
  events: EventContribution[]
): string[] {
  const stimulusIdByName = new Map<string, number>()
  data.stimuli.data.forEach((row, i) => stimulusIdByName.set(row[0], i))
  const participantIdByName = new Map<string, number>()
  data.participants.data.forEach((row, i) => participantIdByName.set(row[0], i))

  const stimuliCount = data.stimuli.data.length
  const participantCount = data.participants.data.length
  const allParticipantIds = Array.from(
    { length: participantCount },
    (_, i) => i
  )

  // channelId lookup per stimulus, keyed by channel name.
  const channelIdByName: Array<Map<string, number>> = Array.from(
    { length: stimuliCount },
    () => new Map()
  )

  const ed = data.eventData
  let anyEvent = false
  const droppedByStimulus = new Map<string, number>()
  const droppedByParticipant = new Map<string, number>()

  for (const event of events) {
    const sId = stimulusIdByName.get(event.stimulus)
    if (sId === undefined) {
      droppedByStimulus.set(
        event.stimulus,
        (droppedByStimulus.get(event.stimulus) ?? 0) + 1
      )
      continue
    }
    let pIds: number[]
    if (event.participant === '*') {
      pIds = allParticipantIds
    } else {
      const pId = participantIdByName.get(event.participant)
      if (pId === undefined) {
        droppedByParticipant.set(
          event.participant,
          (droppedByParticipant.get(event.participant) ?? 0) + 1
        )
        continue
      }
      pIds = [pId]
    }

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
    for (const pId of pIds) {
      ed.events[sId][chId][pId].push(event.start, event.duration)
    }
    anyEvent = true
  }

  // Per-stimulus channel order, mirroring the engine's updateEventDataBatch
  // bookkeeping.
  ed.orderVector = Array.from({ length: stimuliCount }, (_, s) =>
    ed.data[s].map((_, i) => i)
  )

  if (anyEvent) data.capabilities.event = true

  const warnings: string[] = []
  for (const [name, count] of droppedByStimulus) {
    warnings.push(`${count} event(s) referenced unknown stimulus '${name}'`)
  }
  for (const [name, count] of droppedByParticipant) {
    warnings.push(`${count} event(s) referenced unknown participant '${name}'`)
  }
  return warnings
}
