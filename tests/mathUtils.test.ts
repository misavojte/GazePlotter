import { describe, it, expect } from 'vitest'
import {
  createMatrix,
  formatDecimal,
  calculateAverage,
  sumArray,
  normalizeToPercentages,
  arraysHaveSameElements,
  createArray,
} from '$lib/utils/mathUtils'

describe('mathUtils', () => {
  describe('createArray', () => {
    it('should create array with primitive values', () => {
      const arr = createArray(3, 42)
      expect(arr).toHaveLength(3)
      expect(arr).toEqual([42, 42, 42])
    })

    it('should create array with zero length', () => {
      const arr = createArray(0, 'test')
      expect(arr).toHaveLength(0)
    })

    it('should handle object references correctly', () => {
      const obj = { value: 1 }
      const arr = createArray(2, obj)

      // Modifying one element affects all (same reference)
      arr[0].value = 2
      expect(arr[1].value).toBe(2)
    })
  })

  describe('createMatrix', () => {
    it('should create matrix with primitive values', () => {
      const matrix = createMatrix(2, 3, 0)
      expect(matrix).toHaveLength(2)
      expect(matrix[0]).toHaveLength(3)
      expect(matrix).toEqual([
        [0, 0, 0],
        [0, 0, 0],
      ])
    })

    it('should create empty matrix with zero dimensions', () => {
      const matrix = createMatrix(0, 0, 'test')
      expect(matrix).toHaveLength(0)
    })

    it('should handle object references correctly', () => {
      const obj = { value: 1 }
      const matrix = createMatrix(2, 2, obj)

      // Modifying one element affects all (same reference)
      matrix[0][0].value = 2
      expect(matrix[1][1].value).toBe(2)
    })
  })

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

  describe('calculateAverage', () => {
    it('should calculate average of positive numbers', () => {
      expect(calculateAverage([1, 2, 3, 4, 5])).toBe(3)
    })

    it('should handle empty array', () => {
      expect(calculateAverage([])).toBe(0)
    })

    it('should handle array with single value', () => {
      expect(calculateAverage([42])).toBe(42)
    })

    it('should handle negative numbers', () => {
      expect(calculateAverage([-1, 0, 1])).toBe(0)
    })

    it('should handle decimal numbers', () => {
      expect(calculateAverage([1.5, 2.5, 3.5])).toBe(2.5)
    })
  })

  describe('sumArray', () => {
    it('should sum positive numbers', () => {
      expect(sumArray([1, 2, 3, 4, 5])).toBe(15)
    })

    it('should handle empty array', () => {
      expect(sumArray([])).toBe(0)
    })

    it('should handle array with single value', () => {
      expect(sumArray([42])).toBe(42)
    })

    it('should handle negative numbers', () => {
      expect(sumArray([-1, 0, 1])).toBe(0)
    })

    it('should handle decimal numbers', () => {
      expect(sumArray([1.1, 2.2, 3.3])).toBe(6.6)
    })
  })

  describe('normalizeToPercentages', () => {
    it('should normalize values to percentages', () => {
      const result = normalizeToPercentages([1, 2, 1])
      expect(result).toEqual([25, 50, 25])
    })

    it('should handle array with single value', () => {
      expect(normalizeToPercentages([5])).toEqual([100])
    })

    it('should handle array with all zeros', () => {
      expect(normalizeToPercentages([0, 0, 0])).toEqual([0, 0, 0])
    })

    it('should handle empty array', () => {
      expect(normalizeToPercentages([])).toEqual([])
    })

    it('should handle decimal values', () => {
      const result = normalizeToPercentages([0.5, 1.5, 2])
      expect(result[0]).toBeCloseTo(12.5)
      expect(result[1]).toBeCloseTo(37.5)
      expect(result[2]).toBeCloseTo(50)
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
