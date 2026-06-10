/**
 * PERFORMANCE BASELINE — ingest stream pipeline.
 *
 * Phase 0 of the ingest v2 refactor. Run with `npm run bench`. Record the
 * results in `tests/ingestBenchmark.baseline.md` BEFORE refactoring; re-run
 * after each refactor phase. Budget: within ±5% of baseline (noise band) —
 * the kernel must add no per-row or per-chunk overhead.
 *
 * The workloads mirror the two hot real-world shapes:
 *  - a wide-ish plain CSV (120k rows), exercising the generic compiled
 *    row parser and the byte dictionaries;
 *  - the real Tobii mobile fixture body repeated (~32k rows), exercising
 *    the most complex adapter (interval-based media parsing, AOI columns).
 */

import { bench, describe } from 'vitest'
import { EyePipeline } from '$lib/data/ingest/stream/Pipeline'
import { testMobileTsvData } from './TobiiAdapter.test.data'

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
      const pipeline = new EyePipeline(['bench.csv'], async () => '')
      const result = await pipeline.addNewStream(streamFromBytes(csvBytes))
      if (!result) throw new Error('no result')
    },
    { time: 3000, warmupIterations: 2 }
  )

  bench(
    'tobii-with-event ~33k rows → DataType',
    async () => {
      const pipeline = new EyePipeline(
        ['bench.tsv'],
        async () => 'IntervalStart;IntervalEnd'
      )
      const result = await pipeline.addNewStream(streamFromBytes(tobiiBytes))
      if (!result) throw new Error('no result')
    },
    { time: 3000, warmupIterations: 2 }
  )
})
