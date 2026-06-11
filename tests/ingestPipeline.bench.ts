/**
 * PERFORMANCE BASELINE — ingest stream pipeline.
 *
 * Run with `npm run bench`. Record the results in
 * `tests/ingestBenchmark.baseline.md` BEFORE refactoring; re-run after each
 * refactor phase. Budget: within ±5% of baseline (noise band) — the kernel
 * must add no per-row or per-chunk overhead.
 *
 * The workloads mirror the two hot real-world shapes:
 *  - a wide-ish plain CSV (120k rows), exercising the generic compiled
 *    row parser and the byte dictionaries;
 *  - the real Tobii mobile fixture body repeated (~32k rows), exercising
 *    the most complex RowParser (interval-based media parsing, AOI columns).
 */

import { bench, describe } from 'vitest'
import { IngestJob } from '$lib/data/ingest/kernel/job'
import { streamSource } from '$lib/data/ingest/kernel/source'
import { FORMAT_REGISTRY } from '$lib/data/ingest/formats/registry'
import { testMobileTsvData } from './TobiiRowParser.test.data'

const CHUNK = 1024 * 1024 // mirror worker.ts evalBuffer chunking

function streamFromBytes(bytes: Uint8Array) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += CHUNK) {
        controller.enqueue(bytes.subarray(i, Math.min(i + CHUNK, bytes.length)))
      }
      controller.close()
    },
  })
}

async function runJob(name: string, bytes: Uint8Array, userInput: string) {
  const job = new IngestJob([name], FORMAT_REGISTRY, {
    prompt: async () => userInput,
    reportBytes: () => {},
  })
  const result = await job.add(streamSource(name, streamFromBytes(bytes)))
  if (!result) throw new Error('no result')
}

function buildCsv(stimuli: number, participants: number, rowsEach: number) {
  const lines: string[] = ['Time,Participant,Stimulus,AOI']
  for (let s = 0; s < stimuli; s++) {
    for (let p = 0; p < participants; p++) {
      for (let r = 0; r < rowsEach; r++) {
        const aoi = r % 7 === 0 ? '' : `Region_${r % 5}`
        lines.push(`${r * 16},P${p},Stim_${s},${aoi}`)
      }
    }
  }
  return lines.join('\n')
}

function buildTobii(repeats: number) {
  const lines = testMobileTsvData.split('\n')
  const header = lines[0]
  const body = lines.slice(1).join('\n')
  return `${header}\n${Array.from({ length: repeats }, () => body).join('\n')}`
}

// Built once; encoding excluded from the measured work.
const csvBytes = new TextEncoder().encode(buildCsv(4, 25, 1200)) // 120k rows
const tobiiBytes = new TextEncoder().encode(buildTobii(200)) // ~32.8k rows

describe('ingest pipeline throughput', () => {
  bench(
    'csv 120k rows → DataType',
    async () => {
      await runJob('bench.csv', csvBytes, '')
    },
    { time: 3000, warmupIterations: 2 }
  )

  bench(
    'tobii-with-event ~33k rows → DataType',
    async () => {
      await runJob(
        'bench.tsv',
        tobiiBytes,
        '{"stimulusStartSuffix":"IntervalStart","stimulusEndSuffix":"IntervalEnd"}'
      )
    },
    { time: 3000, warmupIterations: 2 }
  )
})
