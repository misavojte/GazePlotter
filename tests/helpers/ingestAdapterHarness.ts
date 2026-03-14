import { decodeBytes, encodeString } from '$lib/data/ingest/utils/byteUtils'

export type EmittedSegment = {
  start: number
  end: number
  categoryId: number
  stimulus: string
  participant: string
  aoi: string[] | null
}

type SegmentHandler = (
  start: number,
  end: number,
  categoryId: number,
  stimulus: Uint8Array,
  participant: Uint8Array,
  aoi: Uint8Array[] | null
) => void

type SegmentEmittingAdapter = {
  onSegment: SegmentHandler | null
  processRowBytes(rawRow: Uint8Array, decoder: TextDecoder): void
  finalize(): void
}

const decoder = new TextDecoder('utf-8')

export function collectAdapterOutputs<T extends SegmentEmittingAdapter>(
  sut: T
): EmittedSegment[] {
  const outputs: EmittedSegment[] = []
  sut.onSegment = (start, end, categoryId, stimulus, participant, aoi) => {
    outputs.push({
      start,
      end,
      categoryId,
      stimulus: decodeBytes(stimulus, decoder),
      participant: decodeBytes(participant, decoder),
      aoi: aoi ? aoi.map(value => decodeBytes(value, decoder)) : null,
    })
  }
  return outputs
}

export function processAdapterRow<T extends SegmentEmittingAdapter>(
  sut: T,
  row: string
): void {
  sut.processRowBytes(encodeString(row, 'utf-8'), decoder)
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
