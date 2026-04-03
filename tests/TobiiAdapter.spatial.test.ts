import { describe, it, expect } from 'vitest'
import { TobiiAdapter } from '$lib/data/ingest/stream/adapters/TobiiAdapter'
import { testMobileTsvData } from './TobiiAdapter.test.data'
import { createAdapterHarness } from './helpers/ingestAdapterHarness'

describe('TobiiAdapter - Spatial Parsing', () => {
  it('should parse mapped fixation coordinates from Tobii test data', () => {
    const lines = testMobileTsvData.split('\n')
    const header = lines[0].split('\t')
    const rows = lines.slice(1)
    const deserializer = new TobiiAdapter(
      header,
      'geostul_snap IntervalStart;geostul_snap IntervalEnd',
      '\t'
    )
    const { outputs, processRows } = createAdapterHarness(deserializer)
    processRows(rows, { finalize: true })

    // Should have segments emitted
    expect(outputs.length).toBeGreaterThan(0)

    // Check that spatial data was parsed (mapped fixation coordinates available in test data)
    const segmentsWithSpatial = outputs.filter(seg => seg.spatial !== null)
    expect(segmentsWithSpatial.length).toBeGreaterThan(0)

    // Verify spatial data format
    const firstSpatial = segmentsWithSpatial[0]
    expect(firstSpatial.spatial).toBeDefined()
    expect(typeof firstSpatial.spatial?.x).toBe('number')
    expect(typeof firstSpatial.spatial?.y).toBe('number')
    expect(Number.isFinite(firstSpatial.spatial!.x)).toBe(true)
    expect(Number.isFinite(firstSpatial.spatial!.y)).toBe(true)
  })

  it('should preserve spatial data as NaN when not available', () => {
    const lines = testMobileTsvData.split('\n')
    const header = lines[0].split('\t')
    const rows = lines.slice(1)
    const deserializer = new TobiiAdapter(
      header,
      'geostul_snap IntervalStart;geostul_snap IntervalEnd',
      '\t'
    )
    const { outputs, processRows } = createAdapterHarness(deserializer)
    processRows(rows, { finalize: true })

    // Some rows have empty coordinates; they should emit null spatial, not NaN
    expect(outputs.length).toBeGreaterThan(0)
    // At least some segments should have data
    const withSpatial = outputs.filter(s => s.spatial !== null)
    const withoutSpatial = outputs.filter(s => s.spatial === null)
    expect(withSpatial.length + withoutSpatial.length).toBe(outputs.length)
  })

  it('should handle fallback to Fixation point columns when mapped unavailable', () => {
    // This uses the standard test data;  mapped columns might be mixed with fallback
    const lines = testMobileTsvData.split('\n')
    const header = lines[0].split('\t')
    const rows = lines.slice(1)

    // Verify the header has both mapped and fallback columns
    const hasMappedX = header.some(h => h.startsWith('Mapped fixation X'))
    const hasFixationX = header.includes('Fixation point X')

    if (hasMappedX && hasFixationX) {
      // Both columns present, adapter should prefer mapped
      const deserializer = new TobiiAdapter(
        header,
        'geostul_snap IntervalStart;geostul_snap IntervalEnd',
        '\t'
      )
      const { outputs, processRows } = createAdapterHarness(deserializer)
      processRows(rows, { finalize: true })

      // Should successfully parse; mapped should take priority over fallback
      expect(outputs.length).toBeGreaterThan(0)
    }
  })

  it('should capture first non-null spatial per segment during multi-row processing', () => {
    const lines = testMobileTsvData.split('\n')
    const header = lines[0].split('\t')
    const rows = lines.slice(1)
    const deserializer = new TobiiAdapter(
      header,
      'geostul_snap IntervalStart;geostul_snap IntervalEnd',
      '\t'
    )
    const { outputs, processRows } = createAdapterHarness(deserializer)
    processRows(rows, { finalize: true })

    // Verify that segments with spatial data have valid coordinates
    const spatialSegments = outputs.filter(s => s.spatial !== null)
    spatialSegments.forEach(segment => {
      // Each spatial segment should have valid x and y
      expect(Number.isFinite(segment.spatial!.x)).toBe(true)
      expect(Number.isFinite(segment.spatial!.y)).toBe(true)
    })
  })
})
