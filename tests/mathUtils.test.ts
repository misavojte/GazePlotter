import { describe, it, expect } from 'vitest'
import {
  formatDecimal,
  arraysHaveSameElements,
} from '$lib/shared/utils/mathUtils'

describe('mathUtils', () => {
  describe('formatDecimal', () => {
    it('should format to specified decimal places', () => {
      expect(formatDecimal(3.14159, 2)).toBe(3.14)
      expect(formatDecimal(3.14159, 3)).toBe(3.142)
      expect(formatDecimal(3.14159, 0)).toBe(3)
    })

    it('should use default decimal places (1)', () => {
      expect(formatDecimal(3.14159)).toBe(3.1)
    })

    it('should round correctly', () => {
      expect(formatDecimal(3.15, 1)).toBe(3.2) // Round up
      expect(formatDecimal(3.14, 1)).toBe(3.1) // Round down
      expect(formatDecimal(3.145, 2)).toBe(3.15) // Round half up
    })

    it('should handle zero and negative numbers', () => {
      expect(formatDecimal(0, 2)).toBe(0)
      expect(formatDecimal(-3.14159, 2)).toBe(-3.14)
    })
  })

  describe('arraysHaveSameElements', () => {
    it('should handle arrays with same elements in same order', () => {
      expect(arraysHaveSameElements([1, 2, 3], [1, 2, 3])).toBe(true)
    })

    it('should handle arrays with same elements in different order', () => {
      expect(arraysHaveSameElements([1, 2, 3], [3, 1, 2])).toBe(true)
    })

    it('should handle arrays with different elements', () => {
      expect(arraysHaveSameElements([1, 2, 3], [1, 2, 4])).toBe(false)
    })

    it('should handle arrays of different lengths', () => {
      expect(arraysHaveSameElements([1, 2], [1, 2, 3])).toBe(false)
    })

    it('should handle empty arrays', () => {
      expect(arraysHaveSameElements([], [])).toBe(true)
    })

    it('should handle arrays with duplicate elements', () => {
      expect(arraysHaveSameElements([1, 1, 2], [1, 2, 1])).toBe(true)
      expect(arraysHaveSameElements([1, 1, 2], [1, 2, 2])).toBe(false)
    })

    it('should handle large arrays', () => {
      const arr1 = Array.from({ length: 100 }, (_, i) => i)
      const arr2 = [...arr1].reverse()
      expect(arraysHaveSameElements(arr1, arr2)).toBe(true)
    })

    it('should handle arrays with string elements', () => {
      expect(arraysHaveSameElements(['a', 'b', 'c'], ['c', 'a', 'b'])).toBe(
        true
      )
    })
  })
})
