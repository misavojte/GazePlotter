import { describe, it, expect } from 'vitest'
import {
  estimateTextWidth,
  calculateTextMetrics,
  calculateLabelOffset,
  truncateTextToPixelWidth,
} from '$lib/utils/textUtils'

describe('textUtils', () => {
  describe('estimateTextWidth', () => {
    it('should estimate width for basic text', () => {
      const width = estimateTextWidth('Hello World')
      expect(width).toBeGreaterThan(0)
      expect(width).toBeLessThan(100) // Reasonable upper bound
    })

    it('should handle different font sizes', () => {
      const smallWidth = estimateTextWidth('Test', 12)
      const largeWidth = estimateTextWidth('Test', 24)
      expect(largeWidth).toBeGreaterThan(smallWidth)
    })

    it('should handle different font families', () => {
      const sansWidth = estimateTextWidth('Test', 12, 'sans-serif')
      const serifWidth = estimateTextWidth('Test', 12, 'serif')
      expect(sansWidth).not.toBe(serifWidth)
    })

    it('should handle special characters', () => {
      const normalWidth = estimateTextWidth('iiii')
      const wideWidth = estimateTextWidth('mmmm')
      expect(wideWidth).toBeGreaterThan(normalWidth)
    })

    it('should handle empty string', () => {
      expect(estimateTextWidth('')).toBe(0)
    })
  })

  describe('calculateTextMetrics', () => {
    it('should calculate metrics for array of texts', () => {
      const texts = ['Short', 'Medium length', 'Very long text string']
      const metrics = calculateTextMetrics(texts)

      expect(metrics.widths).toHaveLength(3)
      expect(metrics.maxWidth).toBeGreaterThan(0)
      expect(metrics.averageWidth).toBeGreaterThan(0)
      expect(metrics.totalWidth).toBeGreaterThan(0)
    })

    it('should handle empty array', () => {
      const metrics = calculateTextMetrics([])
      expect(metrics).toEqual({
        widths: [],
        maxWidth: 0,
        averageWidth: 0,
        totalWidth: 0,
      })
    })

    it('should respect font parameters', () => {
      const texts = ['Test']
      const smallMetrics = calculateTextMetrics(texts, 12)
      const largeMetrics = calculateTextMetrics(texts, 24)
      expect(largeMetrics.maxWidth).toBeGreaterThan(smallMetrics.maxWidth)
    })
  })

  describe('calculateLabelOffset', () => {
    it('should calculate offset based on text width', () => {
      const labels = ['Label 1', 'Label 2', 'Very Long Label']
      const offset = calculateLabelOffset(labels)
      expect(offset).toBeGreaterThan(0)
    })

    it('should respect base offset', () => {
      const labels = ['Test']
      const baseOffset = 50
      const offset = calculateLabelOffset(labels, 12, baseOffset)
      expect(offset).toBeGreaterThan(baseOffset)
    })

    it('should handle empty array', () => {
      const offset = calculateLabelOffset([], 12, 10)
      expect(offset).toBe(10) // Should return base offset
    })
  })

  describe('truncateTextToPixelWidth', () => {
    it('should truncate text that exceeds max width', () => {
      const text = 'This is a very long text that needs to be truncated'
      const truncated = truncateTextToPixelWidth(text, 100)
      expect(truncated.length).toBeLessThan(text.length)
      expect(truncated).toContain('...')
    })

    it('should not truncate text that fits within max width', () => {
      const text = 'Short text'
      const truncated = truncateTextToPixelWidth(text, 200)
      expect(truncated).toBe(text)
    })

    it('should handle different font sizes', () => {
      const text = 'Test text'
      const smallTruncated = truncateTextToPixelWidth(text, 50, 12)
      const largeTruncated = truncateTextToPixelWidth(text, 50, 24)
      expect(smallTruncated.length).toBeGreaterThanOrEqual(
        largeTruncated.length
      )
    })

    it('should handle empty string', () => {
      expect(truncateTextToPixelWidth('', 100)).toBe('')
    })

    it('should handle custom ellipsis', () => {
      const text = 'Long text'
      const truncated = truncateTextToPixelWidth(
        text,
        50,
        12,
        'sans-serif',
        '..'
      )
      expect(truncated).toContain('..')
    })
  })
})
