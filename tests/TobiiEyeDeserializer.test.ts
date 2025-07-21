/**
 * Vitest tests for TobiiEyeDeserializer
 *
 * @module TobiiEyeDeserializer
 * @see $lib/gaze-data/back-process/class/EyeDeserializer/TobiiEyeDeserializer.ts
 */

import { describe, test, expect } from 'vitest'
import { TobiiEyeDeserializer } from '$lib/gaze-data/back-process/class/EyeDeserializer/TobiiEyeDeserializer'
import { testMobileTsvData } from './TobiiEyeDeserializer.test.data'

describe('TobiiEyeDeserializer', () => {
  test('should construct', () => {
    // Placeholder test
    expect(TobiiEyeDeserializer).toBeDefined()
  })

  test('parses testMobileTsvData with IntervalStart;IntervalEnd without errors', () => {
    const lines = testMobileTsvData.split('\n')
    const header = lines[0].split('\t')
    const rows = lines.slice(1).map(line => line.split('\t'))
    const deserializer = new TobiiEyeDeserializer(
      header,
      'IntervalStart;IntervalEnd'
    )
    const outputs = []
    for (const row of rows) {
      const result = deserializer.deserialize(row)
      if (result) outputs.push(result)
    }
    const final = deserializer.finalize()
    if (final) outputs.push(final)
    // outputs now contains all parsed segments, ready for future assertions
    // console.log(outputs) // Uncomment for debugging
  })

  test('first output has correct category, duration, and stimulus', () => {
    const lines = testMobileTsvData.split('\n')
    const header = lines[0].split('\t')
    const rows = lines.slice(1).map(line => line.split('\t'))
    const deserializer = new TobiiEyeDeserializer(
      header,
      ' IntervalStart; IntervalEnd'
    )
    const outputs = []
    for (const row of rows) {
      const result = deserializer.deserialize(row)
      if (result) outputs.push(result)
    }
    const final = deserializer.finalize()
    if (final) outputs.push(final)
    const firstRaw = outputs[0]
    const first = Array.isArray(firstRaw) ? firstRaw[0] : firstRaw

    console.log('FINAL FIRST OUTPUT:', JSON.stringify(first, null, 2))

    expect(first).toBeDefined()
    expect(first.category).toBe('Fixation')
    // First and only AOI should be Kameny
    expect(first.aoi).toBeDefined()
    expect(first.aoi).not.toBeNull()
    // @ts-ignore
    expect(first.aoi[0]).toBe('Kameny')
    expect(first.stimulus).toBe('geostul_snap')
    expect(first.start).toBe('0')
    expect(Number(first.end) - Number(first.start)).toBeCloseTo(460.8345, 1)
  })
})
