/**
 * Vitest tests for TobiiAdapter
 *
 * @module TobiiAdapter
 * @see $lib/data/ingest/stream/adapters/TobiiAdapter.ts
 */

import { describe, test, expect } from 'vitest'
import { TobiiAdapter } from '$lib/data/ingest/stream/adapters/TobiiAdapter'
import { testMobileTsvData } from './TobiiAdapter.test.data'
import { createAdapterHarness } from './helpers/ingestAdapterHarness'

describe('TobiiAdapter', () => {
  test('should construct', () => {
    // Placeholder test
    expect(TobiiAdapter).toBeDefined()
  })

  test('parses testMobileTsvData with IntervalStart;IntervalEnd without errors', () => {
    const lines = testMobileTsvData.split('\n')
    const header = lines[0].split('\t')
    const rows = lines.slice(1)
    const deserializer = new TobiiAdapter(
      header,
      'IntervalStart;IntervalEnd',
      '\t'
    )
    const { outputs, processRows } = createAdapterHarness(deserializer)
    processRows(rows, { finalize: true })
    expect(outputs.length).toBeGreaterThan(0)
  })

  test('first output has correct category, duration, and stimulus', () => {
    const lines = testMobileTsvData.split('\n')
    const header = lines[0].split('\t')
    const rows = lines.slice(1)
    const deserializer = new TobiiAdapter(
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
