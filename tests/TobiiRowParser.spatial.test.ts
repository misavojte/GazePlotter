import { describe, it, expect } from 'vitest'
import { TobiiRowParser } from '$lib/data/ingest/formats/lib/rows/TobiiRowParser'
import { testMobileTsvData } from './TobiiRowParser.test.data'
import { createAdapterHarness } from './helpers/ingestAdapterHarness'

describe('TobiiRowParser - Spatial Parsing', () => {
  it('should parse mapped fixation coordinates from Tobii test data', () => {
    const lines = testMobileTsvData.split('\n')
    const header = lines[0].split('\t')
    const rows = lines.slice(1)
    const deserializer = new TobiiRowParser(
      header,
      '{"stimulusStartSuffix":"geostul_snap IntervalStart","stimulusEndSuffix":"geostul_snap IntervalEnd"}',
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

})
