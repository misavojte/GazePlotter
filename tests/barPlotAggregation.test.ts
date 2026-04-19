import { describe, it, expect } from 'vitest'
import { aggregateMetrics } from '../src/lib/plots/bar/core/transformer'
import type { ParticipantBarMetrics } from '../src/lib/plots/bar/types'

describe('Bar Plot Aggregation Metrics', () => {
  const createMetric = (
    overrides: Partial<ParticipantBarMetrics>
  ): ParticipantBarMetrics => ({
    dwellTime: [],
    ttff: [],
    fixationCount: [],
    hitRatio: [],
    entryCount: [],
    dwellDurations: [],
    firstFixationDuration: [],
    avgFixationDuration: [],
    fixationAoiSequence: [],
    fixationTimestamps: [],
    ...overrides,
  })

  const aoiCount = 2

  describe('absoluteTime & relativeTime', () => {
    it('sum aggregation (absoluteTime)', () => {
      const metrics = [
        createMetric({ dwellTime: [100, 200, 50] }),
        createMetric({ dwellTime: [50, 300, 0] }),
        createMetric({ dwellTime: [0, 0, 10] }),
      ]
      const result = aggregateMetrics(metrics, 'absoluteTime', aoiCount)
      expect(result).toEqual([150, 500, 60])
    })

    it('percentage aggregation (relativeTime) handles one participant', () => {
      const metrics = [createMetric({ dwellTime: [100, 300, 100] })]
      const result = aggregateMetrics(metrics, 'relativeTime', aoiCount)
      // Total 500. 100/500=20%, 300/500=60%, 100/500=20%
      expect(result).toEqual([20, 60, 20])
    })

    it('relativeTime handles total zero sum', () => {
      const metrics = [createMetric({ dwellTime: [0, 0, 0] })]
      const result = aggregateMetrics(metrics, 'relativeTime', aoiCount)
      expect(result).toEqual([0, 0, 0])
    })
  })

  describe('Averages (TTFF, Fixation Duration, Dwell Duration)', () => {
    it('timeToFirstFixation ignores -1 (not seen)', () => {
      const metrics = [
        createMetric({ ttff: [100, -1, 50] }),
        createMetric({ ttff: [200, 300, -1] }),
        createMetric({ ttff: [-1, -1, -1] }),
      ]
      const result = aggregateMetrics(metrics, 'timeToFirstFixation', aoiCount)
      // AOI1: (100+200)/2 = 150
      // AOI2: 300/1 = 300
      // NoAOI: 50/1 = 50
      expect(result).toEqual([150, 300, 50])
    })

    it('avgFixationDuration aggregates across all participants segments', () => {
      const metrics = [
        createMetric({ avgFixationDuration: [[10, 20], [100], []] }),
        createMetric({ avgFixationDuration: [[], [200, 300], [40]] }),
      ]
      const result = aggregateMetrics(metrics, 'avgFixationDuration', aoiCount)
      // AOI1: (10+20)/2 = 15 (wait, sum(10,20)/2 = 15. Then P2 has 0. Total count is 2. (10+20)/2 = 15)
      // Actually my impl: for (p=0; p<count; p++) { for (d=0; d<durations.length; d++) { sum += durations[d]; count++ } }
      // So it's (10+20 + nothing) / (2 segments + 0 segments) = 15.
      // AOI2: (100 + 200 + 300) / (1 + 2) = 600 / 3 = 200.
      // NoAOI: (40) / (1) = 40.
      expect(result).toEqual([15, 200, 40])
    })

    it('avgDwellDuration aggregates across all participants dwells', () => {
      const metrics = [
        createMetric({ dwellDurations: [[1000, 2000], [], [500]] }),
        createMetric({ dwellDurations: [[], [1500], [500]] }),
      ]
      const result = aggregateMetrics(metrics, 'avgDwellDuration', aoiCount)
      // AOI1: (1000+2000)/2 = 1500
      // AOI2: 1500/1 = 1500
      // NoAOI: (500+500)/2 = 500
      expect(result).toEqual([1500, 1500, 500])
    })

    it('avgFirstFixationDuration averages valid first fixations', () => {
      const metrics = [
        createMetric({ firstFixationDuration: [50, -1, 10] }),
        createMetric({ firstFixationDuration: [150, 200, -1] }),
      ]
      const result = aggregateMetrics(
        metrics,
        'avgFirstFixationDuration',
        aoiCount
      )
      expect(result).toEqual([100, 200, 10])
    })
  })

  describe('Counts & Ratios', () => {
    it('averageFixationCount is simple mean per participant', () => {
      const metrics = [
        createMetric({ fixationCount: [10, 2, 0] }),
        createMetric({ fixationCount: [0, 8, 4] }),
      ]
      const result = aggregateMetrics(metrics, 'averageFixationCount', aoiCount)
      // AOI1: (10+0)/2 = 5
      // AOI2: (2+8)/2 = 5
      // NoAOI: (0+4)/2 = 2
      expect(result).toEqual([5, 5, 2])
    })

    it('averageEntries is mean of entryCount per participant', () => {
      const metrics = [
        createMetric({ entryCount: [1, 5, 0] }),
        createMetric({ entryCount: [3, 1, 2] }),
      ]
      const result = aggregateMetrics(metrics, 'averageEntries', aoiCount)
      expect(result).toEqual([2, 3, 1])
    })
  })

  describe('Edge Cases', () => {
    it('handles absolutely no data', () => {
      const result = aggregateMetrics([], 'absoluteTime', aoiCount)
      expect(result).toEqual([0, 0, 0])
    })

    it('handles invalid method gracefully', () => {
      const metrics = [createMetric({ dwellTime: [100, 100, 100] })]
      const result = aggregateMetrics(metrics, 'nonExistentMethod', aoiCount)
      expect(result).toEqual([0, 0, 0])
    })

    it('handles null or undefined values if they were to occur (robustness check)', () => {
      // Technically TypeScript prevents this but runtime data might be weird
      const metrics = [createMetric({ dwellTime: [NaN, 100, 0] })]
      const result = aggregateMetrics(metrics, 'absoluteTime', aoiCount)
      expect(result[1]).toBe(100)
    })
  })
})
