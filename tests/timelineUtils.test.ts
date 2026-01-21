import { describe, it, expect } from 'vitest'
import {
  formatTimelineLabel,
  calculateNiceStepSize,
  getTimelinePositionRatio,
  createAdaptiveTimeline,
  getIntermediateTicks,
} from '$lib/plots/shared/timelineUtils'

describe('timelineUtils', () => {
  describe('formatTimelineLabel', () => {
    it('should format large numbers without decimals', () => {
      expect(formatTimelineLabel(1234.56)).toBe('1,235')
      expect(formatTimelineLabel(1000)).toBe('1,000')
    })

    it('should format integers without decimals', () => {
      expect(formatTimelineLabel(100)).toBe('100')
      expect(formatTimelineLabel(0)).toBe('0')
    })

    it('should format small numbers with decimals', () => {
      expect(formatTimelineLabel(0.1234)).toBe('0.12')
      expect(formatTimelineLabel(0.01234)).toBe('0.012')
      expect(formatTimelineLabel(0.001234)).toBe('0.0012')
    })

    it('should handle zero explicitly', () => {
      expect(formatTimelineLabel(0)).toBe('0')
    })
  })

  describe('calculateNiceStepSize', () => {
    it('should return 1 for zero range', () => {
      expect(calculateNiceStepSize(0, 6)).toBe(1)
    })

    it('should return a nice step size for large range', () => {
      // range=1000, count=6 -> initial step = 200 -> nice=200
      expect(calculateNiceStepSize(1000, 6)).toBe(200)
      // range=1000, count=11 -> initial step = 100 -> nice=100
      expect(calculateNiceStepSize(1000, 11)).toBe(100)
    })

    it('should return a nice step size for small range', () => {
      // range=1, count=6 -> initial step = 0.2 -> nice=0.2
      expect(calculateNiceStepSize(1, 6)).toBe(0.2)
    })
  })

  describe('getTimelinePositionRatio', () => {
    const timeline = { minValue: 0, maxValue: 1000 }

    it('should calculate ratio correctly', () => {
      expect(getTimelinePositionRatio(timeline, 0)).toBe(0)
      expect(getTimelinePositionRatio(timeline, 500)).toBe(0.5)
      expect(getTimelinePositionRatio(timeline, 1000)).toBe(1)
    })

    it('should clamp values outside range', () => {
      expect(getTimelinePositionRatio(timeline, -100)).toBe(0)
      expect(getTimelinePositionRatio(timeline, 1100)).toBe(1)
    })

    it('should return 0 for invalid range', () => {
      expect(
        getTimelinePositionRatio({ minValue: 100, maxValue: 50 }, 75)
      ).toBe(0)
    })
  })

  describe('createAdaptiveTimeline', () => {
    it('should create a timeline for typical range', () => {
      const timeline = createAdaptiveTimeline(0, 1000, 6)
      expect(timeline.minValue).toBe(0)
      expect(timeline.maxValue).toBe(1000)
      expect(timeline.ticks).toHaveLength(6)
      expect(timeline.ticks[0].value).toBe(0)
      expect(timeline.ticks[5].value).toBe(1000)
      expect(timeline.ticks[0].isNice).toBe(true)
      expect(timeline.ticks[5].isNice).toBe(true)
    })

    it('should ensure ticks are within bounds', () => {
      const timeline = createAdaptiveTimeline(150, 850, 6)
      expect(timeline.minValue).toBe(150)
      expect(timeline.maxValue).toBe(850)
      expect(timeline.ticks[0].value).toBe(150)
      expect(timeline.ticks[timeline.ticks.length - 1].value).toBe(850)
    })

    it('should handle zero range', () => {
      const timeline = createAdaptiveTimeline(0, 0, 6)
      expect(timeline.ticks).toHaveLength(1)
      expect(timeline.ticks[0].value).toBe(0)
    })

    it('should handle negative min value by clamping to zero', () => {
      const timeline = createAdaptiveTimeline(-100, 500, 6)
      expect(timeline.minValue).toBe(0)
    })
  })

  describe('getIntermediateTicks', () => {
    it('should return ticks between first and last', () => {
      const timeline = createAdaptiveTimeline(0, 1000, 6)
      const intermediate = getIntermediateTicks(timeline)
      expect(intermediate).toHaveLength(4)
      expect(intermediate[0].value).toBe(200)
      expect(intermediate[3].value).toBe(800)
    })

    it('should return empty array if less than 3 ticks', () => {
      const timeline = {
        minValue: 0,
        maxValue: 100,
        ticks: [
          { label: '0', value: 0, position: 0, isNice: true },
          { label: '100', value: 100, position: 1, isNice: true },
        ],
      }
      expect(getIntermediateTicks(timeline)).toHaveLength(0)
    })
  })
})
