/**
 * Vitest tests for TobiiAdapter
 *
 * @module TobiiAdapter
 * @see $lib/data/ingest/stream/adapters/TobiiAdapter.ts
 */

import { describe, it, expect } from 'vitest'
import { TobiiAdapter } from '$lib/data/ingest/stream/adapters/TobiiAdapter'
import { testMobileTsvData } from './TobiiAdapter.test.data'
import { decodeBytes, encodeString } from '$lib/data/ingest/utils/byteUtils'

type EmittedSegment = {
  start: number
  end: number
  categoryId: number
  stimulus: string
  participant: string
  aoi: string[] | null
}

const decoder = new TextDecoder('utf-8')
const encodeRow = (row: string) => encodeString(row, 'utf-8')

const collectOutputs = (deserializer: TobiiAdapter) => {
  const outputs: EmittedSegment[] = []
  deserializer.onSegment = (
    start,
    end,
    categoryId,
    stimulus,
    participant,
    aoi
  ) => {
    outputs.push({
      start,
      end,
      categoryId,
      stimulus: decodeBytes(stimulus, decoder),
      participant: decodeBytes(participant, decoder),
      aoi: aoi ? aoi.map(a => decodeBytes(a, decoder)) : null,
    })
  }
  return outputs
}

describe('TobiiAdapter', () => {
  it('should construct', () => {
    // Placeholder test
    expect(TobiiAdapter).toBeDefined()
  })

  it('parses testMobileTsvData with IntervalStart;IntervalEnd without errors', () => {
    const lines = testMobileTsvData.split('\n')
    const header = lines[0].split('\t')
    const rows = lines.slice(1)
    const deserializer = new TobiiAdapter(
      header,
      'IntervalStart;IntervalEnd',
      '\t'
    )
    const outputs = collectOutputs(deserializer)
    for (const row of rows) {
      deserializer.processRowBytes(encodeRow(row), decoder)
    }
    deserializer.finalize()
    // outputs now contains all parsed segments, ready for future assertions
    // console.log(outputs) // Uncomment for debugging
    expect(outputs.length).toBeGreaterThan(0)
  })

  it('first output has correct category, duration, and stimulus', () => {
    const lines = testMobileTsvData.split('\n')
    const header = lines[0].split('\t')
    const rows = lines.slice(1)
    const deserializer = new TobiiAdapter(
      header,
      ' IntervalStart; IntervalEnd',
      '\t'
    )
    const outputs = collectOutputs(deserializer)
    for (const row of rows) {
      deserializer.processRowBytes(encodeRow(row), decoder)
    }
    deserializer.finalize()
    const first = outputs[0]

    expect(first).toBeDefined()
    expect(first.categoryId).toBe(0)
    // First and only AOI should be Kameny
    expect(first.aoi).toBeDefined()
    expect(first.aoi).not.toBeNull()
    expect(first.aoi?.[0]).toBe('Kameny')
    expect(first.stimulus).toBe('geostul_snap')
    expect(first.start).toBe(0)
    expect(first.end - first.start).toBeCloseTo(460.8345, 1)
  })
})
