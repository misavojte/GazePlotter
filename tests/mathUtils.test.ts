import { describe, it, expect } from 'vitest'
import {
  formatDecimal,
  arraysHaveSameElements,
  distanceToSegment,
} from '$lib/shared/utils/mathUtils'

describe('mathUtils', () => {
  // Hit-testing a drawn link: the ends must be CAPS, not an infinite line, or a
  // pointer far past an endpoint would resolve to that edge.
  describe('distanceToSegment', () => {
    it('measures perpendicular distance beside the segment', () => {
      expect(distanceToSegment(5, 3, 0, 0, 10, 0)).toBe(3)
      expect(distanceToSegment(0, 0, 0, -4, 0, 4)).toBe(0)
    })

    it('clamps past either end instead of extending the line', () => {
      // On the infinite line these would read 0; as a segment they are 5 away.
      expect(distanceToSegment(15, 0, 0, 0, 10, 0)).toBe(5)
      expect(distanceToSegment(-5, 0, 0, 0, 10, 0)).toBe(5)
    })

    it('handles a degenerate zero-length segment as a point', () => {
      expect(distanceToSegment(3, 4, 0, 0, 0, 0)).toBe(5)
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
