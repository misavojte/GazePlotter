import { decodeBytes, encodeString } from '$lib/data/ingest/utils/byteUtils'
import { TobiiRowParser } from '$lib/data/ingest/formats/lib/rows/TobiiRowParser'
import type { EventContribution } from '$lib/data/ingest/kernel/sink'

export type EmittedSegment = {
  start: number
  end: number
  categoryId: number
  stimulus: string
  participant: string
  aoi: string[] | null
  spatial?: { x: number; y: number } | null
}

type SegmentHandler = (
  start: number,
  end: number,
  categoryId: number,
  stimulus: Uint8Array,
  participant: Uint8Array,
  aoi: Uint8Array[] | null,
  spatial?: { x: number; y: number } | null
) => void

type SegmentEmittingAdapter = {
  onSegment: SegmentHandler | null
  processRowBytes(rawRow: Uint8Array): void
  finalize(): void
}

const decoder = new TextDecoder('utf-8')

export function collectAdapterOutputs<T extends SegmentEmittingAdapter>(
  sut: T
): EmittedSegment[] {
  const outputs: EmittedSegment[] = []
  sut.onSegment = (
    start,
    end,
    categoryId,
    stimulus,
    participant,
    aoi,
    spatial
  ) => {
    const output: EmittedSegment = {
      start,
      end,
      categoryId,
      stimulus: decodeBytes(stimulus, decoder),
      participant: decodeBytes(participant, decoder),
      aoi: aoi ? aoi.map(value => decodeBytes(value, decoder)) : null,
    }

    if (spatial !== undefined) {
      output.spatial = spatial
    }

    outputs.push(output)
  }
  return outputs
}

export function processAdapterRow<T extends SegmentEmittingAdapter>(
  sut: T,
  row: string
): void {
  sut.processRowBytes(encodeString(row, 'utf-8'))
}

export function processAdapterRows<T extends SegmentEmittingAdapter>(
  sut: T,
  rows: Iterable<string>,
  options: { finalize?: boolean } = {}
): void {
  for (const row of rows) {
    processAdapterRow(sut, row)
  }
  if (options.finalize) {
    sut.finalize()
  }
}

export function createAdapterHarness<T extends SegmentEmittingAdapter>(sut: T) {
  return {
    outputs: collectAdapterOutputs(sut),
    processRow: (row: string) => processAdapterRow(sut, row),
    processRows: (rows: Iterable<string>, options?: { finalize?: boolean }) =>
      processAdapterRows(sut, rows, options),
    finalize: () => sut.finalize(),
  }
}

// Shared base header for Tobii TSV fixtures; tests append/splice extra columns.
export const TOBII_HEADER = [
  'Recording timestamp',
  'Sensor',
  'Participant name',
  'Recording name',
  'Event',
  'Eye movement type',
  'Eye movement type index',
]

export type TobiiRowOpts = {
  ts: number
  event?: string
  gaze?: boolean
  catIdx?: number
  participant?: string
  recording?: string
  /** Extra cells by column name; names absent from the header are ignored. */
  cells?: Record<string, string>
}

export function tobiiRow(
  opts: TobiiRowOpts,
  header: string[] = TOBII_HEADER
): string {
  const cells: string[] = new Array(header.length).fill('')
  const set = (name: string, value: string) => {
    const i = header.indexOf(name)
    if (i >= 0) cells[i] = value
  }
  set('Recording timestamp', String(opts.ts))
  set('Participant name', opts.participant ?? 'P1')
  set('Recording name', opts.recording ?? 'R1')
  if (opts.event) set('Event', opts.event)
  if (opts.gaze) {
    set('Sensor', 'Eye Tracker')
    set('Eye movement type', 'Fixation')
    set('Eye movement type index', String(opts.catIdx ?? 1))
    set('Fixation point X', '500')
    set('Fixation point Y', '500')
  }
  for (const [name, value] of Object.entries(opts.cells ?? {})) set(name, value)
  return cells.join('\t')
}

/** Runs a TobiiRowParser over the rows (finalized), collecting all it emits. */
export function runTobiiParser(
  rows: string[],
  config = '',
  header: string[] = TOBII_HEADER
): {
  outputs: EmittedSegment[]
  events: EventContribution[]
  warnings: string[]
} {
  const parser = new TobiiRowParser(header, config, '\t')
  const outputs = collectAdapterOutputs(parser)
  const events: EventContribution[] = []
  const warnings: string[] = []
  parser.onEvent = event => events.push(event)
  parser.onWarning = message => warnings.push(message)
  processAdapterRows(parser, rows, { finalize: true })
  return { outputs, events, warnings }
}
