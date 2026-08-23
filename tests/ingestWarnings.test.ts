/**
 * Warnings flow end to end: format-level warnings (sink.addWarning, e.g.
 * Tobii event extraction) and resolution warnings (mergeEvents) ride the
 * dataset Result envelope.
 */

import { describe, expect, test } from 'vitest'
import { IngestJob } from '$lib/data/ingest/kernel/job'
import { streamSource } from '$lib/data/ingest/kernel/source'
import { FORMAT_REGISTRY } from '$lib/data/ingest/formats/registry'
import { TOBII_HEADER, tobiiRow } from './helpers/ingestAdapterHarness'

function streamFromString(content: string) {
  const bytes = new TextEncoder().encode(content)
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
}

async function parseTobii(content: string) {
  const job = new IngestJob(['tobii.tsv'], FORMAT_REGISTRY, {
    prompt: async () =>
      '{"stimulusStartSuffix":"IntervalStart","stimulusEndSuffix":"IntervalEnd"}',
    reportBytes: () => {},
  })
  const result = await job.add(
    streamSource('tobii.tsv', streamFromString(content))
  )
  if (result?.kind !== 'dataset') throw new Error('expected dataset')
  return result
}

describe('dataset result warnings', () => {
  test('an out-of-stimulus event surfaces as a result warning', async () => {
    const content = [
      TOBII_HEADER.join('\t'),
      tobiiRow({ ts: 500, event: 'Stray' }), // before any interval, dropped
      tobiiRow({ ts: 1000, event: 'Stim1 IntervalStart' }),
      tobiiRow({ ts: 2000, gaze: true }),
      tobiiRow({ ts: 6000, gaze: true }),
      tobiiRow({ ts: 9000, event: 'Stim1 IntervalEnd' }),
    ].join('\n')

    const result = await parseTobii(content)
    expect(result.warnings).toEqual([
      '1 event(s) occurred outside any stimulus and were dropped',
    ])
  })

  test('a clean parse carries no warnings key', async () => {
    const content = [
      TOBII_HEADER.join('\t'),
      tobiiRow({ ts: 1000, event: 'Stim1 IntervalStart' }),
      tobiiRow({ ts: 2000, gaze: true }),
      tobiiRow({ ts: 6000, gaze: true }),
      tobiiRow({ ts: 9000, event: 'Stim1 IntervalEnd' }),
    ].join('\n')

    const result = await parseTobii(content)
    expect(result.warnings).toBeUndefined()
  })
})
