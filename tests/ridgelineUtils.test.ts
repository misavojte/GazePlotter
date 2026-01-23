import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateIdealStripHeight } from '$lib/plots/aoi-stream/core/ridgeline'
import { scanForDynamicStripHeight } from '$lib/plots/aoi-stream/sync/ridgeline'

// Mock dependencies
vi.mock('$lib/plots/shared/utils/plotSizeUtility', () => ({
  calculatePlotDimensionsWithHeader: () => ({ width: 800, height: 600 }),
}))

vi.mock('$lib/plots/aoi-stream/utils', () => ({
  getAoiStreamPlotData: () => ({
    series: [], // Mocked per test
    binCount: 100,
    participants: 1,
  }),
  scanForSynchronizedTimelineMax: () => null,
}))

vi.mock('$lib/plots/shared', () => ({
  calculateFlatLegendHeight: () => 50,
  STREAM_LEGEND_CONFIG: { fontSize: 12, fontFamily: 'Arial' },
}))

vi.mock('$lib/shared/utils/textUtils', () => ({
  estimateTextWidth: () => 10,
  SYSTEM_SANS_SERIF_STACK: 'Arial',
}))

describe('Ridgeline Utilities', () => {
  describe('calculateIdealStripHeight', () => {
    it('should calculate correct height for single series at 100%', () => {
      // Setup: 1 series, 100% max value
      const data = {
        series: [
          {
            values: new Float32Array(10).fill(1),
            id: 1,
            label: 's1',
            color: 'red',
          },
        ],
        binCount: 10,
        participants: 1,
      } as any
      const plotHeight = 100

      // Logic (without applyMinTopHeight):
      // geometricOffset = (1-1-0)*(1-0.6) = 0
      // dataHeight = (100 * 0.9 / 100) = 0.9
      // maxFactor = 0.9
      // Ideal = 100 / 0.9 = 111.11

      const height = calculateIdealStripHeight(data, plotHeight)
      expect(height).toBeCloseTo(111.11, 1)
    })

    it('should respect stacking offset for multiple series', () => {
      // Setup: 2 series, both 0% (empty) to test pure geometric stacking
      // Note: calculateMaxConstraintFactor iterates all.
      const data = {
        series: [
          { values: new Float32Array(10).fill(0), id: 1 }, // Top (s=0)
          { values: new Float32Array(10).fill(0), id: 2 }, // Bottom (s=1)
        ],
        binCount: 10,
        participants: 1,
      } as any
      const plotHeight = 100

      // Logic (without applyMinTopHeight - default for sync):
      // s=0: geom=(2-1-0)*0.4 = 0.4. data=0. Total=0.4
      // s=1: geom=(2-1-1)*0.4 = 0.0. data=0. Total=0.0
      // maxFactor = 0.4

      // Ideal = 100 / 0.4 = 250

      const height = calculateIdealStripHeight(data, plotHeight)
      expect(height).toBeCloseTo(250, 1)
    })

    it('should apply minTopHeight constraint when flag is true', () => {
      // Setup: 2 series, both 0% (empty) to test minTopHeight constraint
      const data = {
        series: [
          { values: new Float32Array(10).fill(0), id: 1 }, // Top (s=0)
          { values: new Float32Array(10).fill(0), id: 2 }, // Bottom (s=1)
        ],
        binCount: 10,
        participants: 1,
      } as any
      const plotHeight = 100

      // Logic (WITH applyMinTopHeight - for local rendering):
      // s=0: geom=(2-1-0)*0.4 = 0.4. data=0. minTopHeight=0.2. Total=0.4 + 0.2 = 0.6
      // s=1: geom=(2-1-1)*0.4 = 0.0. data=0. Total=0.0
      // maxFactor = 0.6

      // Ideal = 100 / 0.6 = 166.67

      const height = calculateIdealStripHeight(data, plotHeight, true)
      expect(height).toBeCloseTo(166.67, 1)
    })

    it('should account for data height in stacking', () => {
      // Setup: 2 series. Top(s=0) has 100%, Bot(s=1) has 0%.
      // Note: Raw value '1' with participants=1 becomes 100%.
      const data = {
        series: [
          { values: new Float32Array(10).fill(1), id: 1 },
          { values: new Float32Array(10).fill(0), id: 2 },
        ],
        binCount: 10,
        participants: 1,
      } as any
      const plotHeight = 100

      // Logic:
      // s=0: geom=0.4. data=(100*0.9/100)=0.9. Total=1.3
      // s=1: geom=0.0. data=0.0. Total=0.0
      // maxFactor = 1.3

      // Ideal = 100 / 1.3 = 76.92

      const height = calculateIdealStripHeight(data, plotHeight)
      expect(height).toBeCloseTo(76.92, 1)
    })
  })
})
