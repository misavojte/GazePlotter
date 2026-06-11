/**
 * Warnings flow end to end: format-level warnings (sink.addWarning, e.g.
 * Tobii event extraction) and resolution warnings (mergeEvents) ride the
 * dataset Result envelope.
 */

import { describe, expect, test } from 'vitest'
import { IngestJob } from '$lib/data/ingest/kernel/job'
import { streamSource } from '$lib/data/ingest/kernel/source'
import { FORMAT_REGISTRY } from '$lib/data/ingest/formats/registry'

const HEADER = [
  'Recording timestamp',
  'Sensor',
  'Participant name',
  'Recording name',
  'Event',
  'Eye movement type',
  'Eye movement type index',
].join('\t')

function row(ts: number, event: string, gaze: boolean): string {
  return [
    String(ts),
    gaze ? 'Eye Tracker' : '',
    'P1',
    'R1',
    event,
    gaze ? 'Fixation' : '',
    gaze ? '1' : '',
  ].join('\t')
}

function streamFromString(content: string) {
  const bytes = new TextEncoder().encode(content)
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
}

describe('dataset result warnings', () => {
  test('an out-of-stimulus event surfaces as a result warning', async () => {
    const content = [
      HEADER,
      row(500, 'Stray', false), // before any interval — dropped
      row(1000, 'Stim1 IntervalStart', false),
      row(2000, '', true),
      row(6000, '', true),
      row(9000, 'Stim1 IntervalEnd', false),
    ].join('\n')

    const job = new IngestJob(['tobii.tsv'], FORMAT_REGISTRY, {
      prompt: async () =>
        '{"stimulusStartSuffix":"IntervalStart","stimulusEndSuffix":"IntervalEnd"}',
      reportBytes: () => {},
    })
    const result = await job.add(
      streamSource('tobii.tsv', streamFromString(content))
    )
    if (result?.kind !== 'dataset') throw new Error('expected dataset')
    expect(result.warnings).toEqual([
      '1 event(s) occurred outside any stimulus and were dropped',
    ])
  })

  test('a clean parse carries no warnings key', async () => {
    const content = [
      HEADER,
      row(1000, 'Stim1 IntervalStart', false),
      row(2000, '', true),
      row(6000, '', true),
      row(9000, 'Stim1 IntervalEnd', false),
    ].join('\n')

    const job = new IngestJob(['tobii.tsv'], FORMAT_REGISTRY, {
      prompt: async () =>
        '{"stimulusStartSuffix":"IntervalStart","stimulusEndSuffix":"IntervalEnd"}',
      reportBytes: () => {},
    })
    const result = await job.add(
      streamSource('tobii.tsv', streamFromString(content))
    )
    if (result?.kind !== 'dataset') throw new Error('expected dataset')
    expect(result.warnings).toBeUndefined()
  })
})
