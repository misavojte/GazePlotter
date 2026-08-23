import { describe, it, expect } from 'vitest'
import { arraysHaveSameElements } from '$lib/metrics/core/transitionScan'

// Visit mode's "same AOI set" test: multiset equality regardless of order.
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
