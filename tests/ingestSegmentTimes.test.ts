/**
 * Impossible segment times never reach the dataset. The writer drops any
 * segment whose start or end is not finite or whose end precedes its start,
 * and reports one warning per reason. Varjo also rejects a malformed Time.
 * Cases come from the importer fuzz run of 2026-10-29.
 */

import { describe, expect, test } from 'vitest'
import { IngestJob } from '$lib/data/ingest/kernel/job'
import { streamSource } from '$lib/data/ingest/kernel/source'
import { FORMAT_REGISTRY } from '$lib/data/ingest/formats/registry'
import { SEGMENT_STRIDE, SegmentField } from '$lib/data/binary'
import { SegmentWriter } from '$lib/data/ingest/kernel/segmentWriter'

function streamFromString(content: string) {
  const bytes = new TextEncoder().encode(content)
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
}

async function parse(fileName: string, content: string) {
  const job = new IngestJob([fileName], FORMAT_REGISTRY, {
    prompt: async () => '',
    reportBytes: () => {},
  })
  const result = await job.add(
    streamSource(fileName, streamFromString(content))
  )
  if (result?.kind !== 'dataset') throw new Error('expected dataset')
  return result
}

/** [start, end] of every written segment, in buffer order. */
function spans(buffer: Float32Array): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i < buffer.length; i += SEGMENT_STRIDE) {
    out.push([
      buffer[i + SegmentField.START_TIME],
      buffer[i + SegmentField.END_TIME],
    ])
  }
  return out
}

describe('impossible segment times', () => {
  test('time-series CSV rows out of time order', async () => {
    const result = await parse(
      'series.csv',
      ['Time,Participant,Stimulus,AOI', '1,P1,S1,A1', '0,P1,S1,A1', '2,P1,S1,A2'].join('\n')
    )
    expect(spans(result.data.segments.segmentBuffer)).toEqual([[1, 1]])
    expect(result.warnings).toEqual(['1 segment skipped: end time before start time'])
  })

  test('segmented CSV with To before From', async () => {
    const result = await parse(
      'fromto.csv',
      ['From,To,Participant,Stimulus,AOI', '0,5,P1,S1,A1', '10,0,P1,S1,A2'].join('\n')
    )
    expect(spans(result.data.segments.segmentBuffer)).toEqual([[0, 5]])
    expect(result.warnings).toEqual(['1 segment skipped: end time before start time'])
  })

  test('segmented CSV with a negative duration', async () => {
    const result = await parse(
      'duration.csv',
      [
        'timestamp,duration,AOI,participant,stimulus,eyemovementtype',
        '100,50,A1,P1,S1,0',
        '200,-30,A1,P1,S1,0',
        '300,-1,A2,P1,S1,0',
      ].join('\n')
    )
    expect(spans(result.data.segments.segmentBuffer)).toEqual([[0, 50]])
    expect(result.warnings).toEqual(['2 segments skipped: end time before start time'])
    // A2 was hit only by a skipped segment, so it is not registered.
    expect(result.data.aois.data[0].map(a => a[0])).toEqual(['A1'])
  })

  test('Varjo rows whose Time is not yyyy:MM:dd:HH:mm:ss:SSS', async () => {
    const result = await parse(
      'P1.csv',
      [
        'Time;Actor Label',
        '1000;A1',
        '2022:11:11:15:50:18:30;A1',
        '2022:11:11:15:50:18:40;A1',
        '1100;A2',
        '2022:11:11:15:50:18;A2',
        '2022:11:11:15:50:18:x0;A2',
        '2022:11:11:15:50:18:50;A3',
      ].join('\n')
    )
    expect(spans(result.data.segments.segmentBuffer)).toEqual([
      [0, 10],
      [20, 20],
    ])
    expect(result.warnings).toEqual([
      '4 rows skipped: Time is not in yyyy:MM:dd:HH:mm:ss:SSS format',
    ])
  })

  test('the writer counts non-finite times separately', () => {
    const w = new SegmentWriter()
    const s = new TextEncoder().encode('S1')
    const p = new TextEncoder().encode('P1')
    w.addSegmentBytes(0, 10, 0, s, p, null)
    w.addSegmentBytes(Number.NaN, 10, 0, s, p, null)
    w.addSegmentBytes(0, Number.POSITIVE_INFINITY, 0, s, p, null)
    w.addSegmentBytes(5, 4, 0, s, p, null)
    expect(spans(w.buildFinalData().segments.segmentBuffer)).toEqual([[0, 10]])
    expect(w.skippedSegmentWarnings()).toEqual([
      '2 segments skipped: start or end time is not a number',
      '1 segment skipped: end time before start time',
    ])
  })
})
