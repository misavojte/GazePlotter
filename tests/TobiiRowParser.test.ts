/**
 * Vitest tests for TobiiRowParser
 *
 * @module TobiiRowParser
 * @see $lib/data/ingest/formats/lib/rows/TobiiRowParser.ts
 */

import { describe, it, expect } from 'vitest'
import { TobiiRowParser } from '$lib/data/ingest/formats/lib/rows/TobiiRowParser'
import { testMobileTsvData } from './TobiiRowParser.test.data'
import { createAdapterHarness } from './helpers/ingestAdapterHarness'

describe('TobiiRowParser', () => {
  it('should construct', () => {
    // Placeholder test
    expect(TobiiRowParser).toBeDefined()
  })

  it('parses testMobileTsvData with IntervalStart;IntervalEnd without errors', () => {
    const lines = testMobileTsvData.split('\n')
    const header = lines[0].split('\t')
    const rows = lines.slice(1)
    const deserializer = new TobiiRowParser(
      header,
      'IntervalStart;IntervalEnd',
      '\t'
    )
    const { outputs, processRows } = createAdapterHarness(deserializer)
    processRows(rows, { finalize: true })
    expect(outputs.length).toBeGreaterThan(0)
  })

  it('first output has correct category, duration, and stimulus', () => {
    const lines = testMobileTsvData.split('\n')
    const header = lines[0].split('\t')
    const rows = lines.slice(1)
    const deserializer = new TobiiRowParser(
      header,
      ' IntervalStart; IntervalEnd',
      '\t'
    )
    const { outputs, processRows } = createAdapterHarness(deserializer)
    processRows(rows, { finalize: true })
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
