import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAllAois } from '$lib/data/engine'
import { collectAoiStreamMetrics } from '../src/lib/plots/aoi-stream/core/collector'
import { createReaderFromJson } from '../src/lib/data/binary/converters'
import { FIXATION_CATEGORY_ID } from '../src/lib/plots/aoi-stream/const'

const mockEngine = {
  getReader: vi.fn(),
  getAoiMapping: vi.fn(),
}

// Mock the engine-backed selectors
vi.mock('$lib/data/engine', () => {
  return {
    getAllAois: vi.fn(),
  }
})

// Simple unit test for the calculation logic
describe('Time-binned AOI Occupancy Calculation Logic', () => {
  describe('Timeline cropping calculations', () => {
    it('should correctly calculate adjusted times', () => {
      // Test case 1: Segment completely within cropped range
      const timelineMin = 2000
      const timelineMax = 4000
      const safeMaxTime = timelineMax - timelineMin // 2000

      const start = 2500
      const end = 3500

      const adjustedStart = Math.max(0, start - timelineMin) // 500
      const adjustedEnd = Math.min(safeMaxTime, Math.max(0, end - timelineMin)) // 1500

      expect(adjustedStart).toBe(500)
      expect(adjustedEnd).toBe(1500)
      expect(adjustedEnd - adjustedStart).toBe(1000) // Duration within cropped range
    })

    it('should cap adjusted end to safeMaxTime', () => {
      // Test case 2: Segment extends beyond cropped range
      const timelineMin = 2000
      const timelineMax = 4000
      const safeMaxTime = timelineMax - timelineMin // 2000

      const start = 3000
      const end = 5000 // Extends beyond timelineMax

      const adjustedStart = Math.max(0, start - timelineMin) // 1000
      const adjustedEnd = Math.min(safeMaxTime, Math.max(0, end - timelineMin)) // 2000 (capped)

      expect(adjustedStart).toBe(1000)
      expect(adjustedEnd).toBe(2000)
      expect(adjustedEnd - adjustedStart).toBe(1000) // Only the portion within cropped range
    })

    it('should handle segment completely before cropped range', () => {
      // Test case 3: Segment before timelineMin
      const timelineMin = 2000
      const timelineMax = 4000
      const safeMaxTime = timelineMax - timelineMin // 2000

      const start = 0
      const end = 1000

      const adjustedStart = Math.max(0, start - timelineMin) // 0
      const adjustedEnd = Math.min(safeMaxTime, Math.max(0, end - timelineMin)) // 0

      expect(adjustedStart).toBe(0)
      expect(adjustedEnd).toBe(0)
      expect(adjustedEnd <= adjustedStart).toBe(true) // Should be skipped
    })

    it('should handle segment completely after cropped range', () => {
      // Test case 4: Segment after timelineMax
      const timelineMin = 2000
      const timelineMax = 4000
      const safeMaxTime = timelineMax - timelineMin // 2000

      const start = 5000
      const end = 6000

      const adjustedStart = Math.max(0, start - timelineMin) // 3000
      const adjustedEnd = Math.min(safeMaxTime, Math.max(0, end - timelineMin)) // 2000 (capped)

      expect(adjustedStart).toBe(3000)
      expect(adjustedEnd).toBe(2000)
      expect(adjustedEnd <= adjustedStart).toBe(true) // Should be skipped
    })

    it('should handle segment spanning cropped range', () => {
      // Test case 5: Segment starts before and ends after cropped range
      const timelineMin = 2000
      const timelineMax = 4000
      const safeMaxTime = timelineMax - timelineMin // 2000

      const start = 1000
      const end = 5000

      const adjustedStart = Math.max(0, start - timelineMin) // 0
      const adjustedEnd = Math.min(safeMaxTime, Math.max(0, end - timelineMin)) // 2000

      expect(adjustedStart).toBe(0)
      expect(adjustedEnd).toBe(2000)
      expect(adjustedEnd - adjustedStart).toBe(2000) // Entire cropped range
    })
  })

  describe('Bin calculation logic', () => {
    it('should correctly calculate bin indices', () => {
      const binCount = 10
      const timelineMin = 2000
      const timelineMax = 4000
      const safeMaxTime = timelineMax - timelineMin // 2000
      const binSize = safeMaxTime / binCount // 200
      const invBinSize = 1 / binSize // 0.005

      // Segment from 2500-3500ms (adjusted: 500-1500ms)
      const adjustedStart = 500
      const adjustedEnd = 1500

      const startBin = Math.max(
        0,
        Math.min(binCount - 1, Math.floor(adjustedStart * invBinSize))
      ) // floor(500 * 0.005) = floor(2.5) = 2

      const endBin = Math.min(
        binCount - 1,
        Math.floor((adjustedEnd - 1e-6) * invBinSize)
      ) // floor(1499.999 * 0.005) = floor(7.499995) = 7

      expect(startBin).toBe(2)
      expect(endBin).toBe(7)

      // Overlap calculations
      if (startBin === endBin) {
        // Not this case
      } else {
        const startBinStart = startBin * binSize // 400
        const endBinStart = endBin * binSize // 1400
        const startOverlap = startBinStart + binSize - adjustedStart // 400 + 200 - 500 = 100
        const endOverlap = adjustedEnd - endBinStart // 1500 - 1400 = 100

        expect(startOverlap).toBeCloseTo(100)
        expect(endOverlap).toBeCloseTo(100)

        // Partial contributions
        const startContribution = startOverlap * invBinSize // 100 * 0.005 = 0.5
        const endContribution = endOverlap * invBinSize // 100 * 0.005 = 0.5

        expect(startContribution).toBeCloseTo(0.5)
        expect(endContribution).toBeCloseTo(0.5)

        // Full bins: bins 3-6 (4 bins)
        const fullStart = startBin + 1 // 3
        const fullEnd = endBin - 1 // 6

        expect(fullStart).toBe(3)
        expect(fullEnd).toBe(6)
        expect(fullEnd - fullStart + 1).toBe(4) // 4 full bins
      }
    })
  })

  describe('Grouped AOI integration', () => {
    const stimulusId = 0
    const participantIds = [0]
    const binCount = 1
    const timelineMin = 0
    const safeMaxTime = 100 // 1 bin of 100ms

    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should count fixations from all AOIs in a group, not just the representative', () => {
      // AOIs: 0 (A1), 1 (A2). They are grouped as "A", rep is 0.
      const orderedAois = [{ id: 0, displayedName: 'A', color: 'red' }] as any

      // Mock getAllAois to return all raw AOIs for the stimulus
      vi.mocked(getAllAois).mockReturnValue([{ id: 0 }, { id: 1 }] as any)

      // Mock mapping: both 0 and 1 map to 0
      vi.mocked(mockEngine.getAoiMapping).mockImplementation(
        (_sId: number, rawId: number) => {
          if (rawId === 0 || rawId === 1) return 0
          return rawId
        }
      )

      // Create segments for participant 0
      // Segment 1: 0-50ms, Category FIXATION, AOI 0
      // Segment 2: 50-100ms, Category FIXATION, AOI 1
      const segments = [
        [
          [
            [0, 50, FIXATION_CATEGORY_ID, 0],
            [50, 100, FIXATION_CATEGORY_ID, 1],
          ],
        ],
      ]
      const reader = createReaderFromJson(segments)
      vi.mocked(mockEngine.getReader).mockReturnValue(reader)

      const { metrics } = collectAoiStreamMetrics(
        mockEngine as any,
        stimulusId,
        participantIds,
        orderedAois,
        null,
        binCount,
        timelineMin,
        safeMaxTime,
        null
      )

      // Series 0 is AOI "A" (id 0)
      // It should have total occupancy 1.0 (50ms + 50ms = 100ms / 100ms bin)
      const aoiSeries = metrics.series.find(s => s.id === 0)
      expect(aoiSeries).toBeDefined()
      expect(aoiSeries!.values[0]).toBeCloseTo(1.0)
    })
  })
})
