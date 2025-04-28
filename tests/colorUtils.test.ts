import { describe, it, expect } from 'vitest'
import {
  interpolateColor,
  getColorForValue,
  createColorGradient,
  isDarkColor,
  getContrastTextColor,
} from '$lib/shared/utils/colorUtils'

// Helper function to normalize hex colors for comparison
const normalizeHex = (hex: string) => hex.toLowerCase()

describe('colorUtils', () => {
  describe('interpolateColor', () => {
    it('should interpolate between white and black', () => {
      expect(normalizeHex(interpolateColor('#FFFFFF', '#000000', 0))).toBe(
        '#ffffff'
      )
      expect(normalizeHex(interpolateColor('#FFFFFF', '#000000', 1))).toBe(
        '#000000'
      )
      expect(normalizeHex(interpolateColor('#FFFFFF', '#000000', 0.5))).toBe(
        '#808080'
      )
    })

    it('should interpolate between two arbitrary colors', () => {
      expect(normalizeHex(interpolateColor('#FF0000', '#0000FF', 0.5))).toBe(
        '#800080'
      )
    })

    it('should handle same color interpolation', () => {
      expect(normalizeHex(interpolateColor('#FF0000', '#FF0000', 0.5))).toBe(
        '#ff0000'
      )
    })
  })

  describe('getColorForValue', () => {
    it('should handle two-color scale', () => {
      const colorScale = ['#000000', '#FFFFFF']
      expect(normalizeHex(getColorForValue(0, 0, 100, colorScale))).toBe(
        '#000000'
      )
      expect(normalizeHex(getColorForValue(100, 0, 100, colorScale))).toBe(
        '#ffffff'
      )
      expect(normalizeHex(getColorForValue(50, 0, 100, colorScale))).toBe(
        '#808080'
      )
    })

    it('should handle three-color scale', () => {
      const colorScale = ['#000000', '#FF0000', '#FFFFFF']
      expect(normalizeHex(getColorForValue(0, 0, 100, colorScale))).toBe(
        '#000000'
      )
      expect(normalizeHex(getColorForValue(50, 0, 100, colorScale))).toBe(
        '#ff0000'
      )
      expect(normalizeHex(getColorForValue(100, 0, 100, colorScale))).toBe(
        '#ffffff'
      )
    })

    it('should handle zero value', () => {
      const colorScale = ['#000000', '#FFFFFF']
      expect(normalizeHex(getColorForValue(0, 0, 100, colorScale))).toBe(
        '#000000'
      )
    })

    it('should handle zero max value', () => {
      const colorScale = ['#000000', '#FFFFFF']
      expect(normalizeHex(getColorForValue(0, 0, 0, colorScale))).toBe(
        '#000000'
      )
    })
  })

  describe('createColorGradient', () => {
    it('should create gradient with correct number of steps', () => {
      const gradient = createColorGradient('#000000', '#FFFFFF', 5)
      expect(gradient).toHaveLength(5)
      expect(normalizeHex(gradient[0])).toBe('#000000')
      expect(normalizeHex(gradient[4])).toBe('#ffffff')
    })

    it('should create gradient with two steps', () => {
      const gradient = createColorGradient('#000000', '#FFFFFF', 2)
      expect(gradient.map(normalizeHex)).toEqual(['#000000', '#ffffff'])
    })

    it('should handle same color gradient', () => {
      const gradient = createColorGradient('#FF0000', '#FF0000', 3)
      expect(gradient.map(normalizeHex)).toEqual([
        '#ff0000',
        '#ff0000',
        '#ff0000',
      ])
    })
  })

  describe('isDarkColor', () => {
    it('should identify dark colors', () => {
      expect(isDarkColor('#000000')).toBe(true)
      expect(isDarkColor('#500000')).toBe(true)
      expect(isDarkColor('#0000FF')).toBe(true)
    })

    it('should identify light colors', () => {
      expect(isDarkColor('#FFFFFF')).toBe(false)
      expect(isDarkColor('#FFFF00')).toBe(false)
      expect(isDarkColor('#90EE90')).toBe(false)
    })

    it('should handle edge cases', () => {
      // Gray at exactly 50% brightness
      expect(isDarkColor('#7F7F7F')).toBe(true)
    })
  })

  describe('getContrastTextColor', () => {
    it('should return white text for dark backgrounds', () => {
      expect(normalizeHex(getContrastTextColor('#000000'))).toBe('#ffffff')
      expect(normalizeHex(getContrastTextColor('#500000'))).toBe('#ffffff')
      expect(normalizeHex(getContrastTextColor('#0000FF'))).toBe('#ffffff')
    })

    it('should return black text for light backgrounds', () => {
      expect(normalizeHex(getContrastTextColor('#FFFFFF'))).toBe('#000000')
      expect(normalizeHex(getContrastTextColor('#FFFF00'))).toBe('#000000')
      expect(normalizeHex(getContrastTextColor('#90EE90'))).toBe('#000000')
    })
  })
})
