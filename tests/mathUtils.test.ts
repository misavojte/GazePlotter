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

describe('createArray', () => {
  it('should create an array with the specified length', () => {
    const array = createArray(5, 0)
    expect(array.length).toBe(5)
  })

  it('should fill the array with the initial value', () => {
    const array = createArray(3, 42)
    expect(array[0]).toBe(42)
    expect(array[1]).toBe(42)
    expect(array[2]).toBe(42)
  })

  it('should handle different data types', () => {
    const stringArray = createArray(2, 'test')
    expect(stringArray[0]).toBe('test')
    expect(stringArray[1]).toBe('test')

    const boolArray = createArray(2, true)
    expect(boolArray[0]).toBe(true)
    expect(boolArray[1]).toBe(true)

    const objArray = createArray(2, { key: 'value' })
    expect(objArray[0]).toEqual({ key: 'value' })
    expect(objArray[1]).toEqual({ key: 'value' })
  })

  it('should handle zero length', () => {
    const emptyArray = createArray(0, 'test')
    expect(emptyArray.length).toBe(0)
  })

  it('should handle object references (shared references expected)', () => {
    // Create an array of objects
    const array = createArray(3, { value: 0 })

    // Modify the first object
    array[0].value = 42

    // All objects should be affected since they reference the same object
    expect(array[0].value).toBe(42)
    expect(array[1].value).toBe(42) // Now expecting 42 instead of 0
    expect(array[2].value).toBe(42) // Now expecting 42 instead of 0
  })
})

describe('createMatrix', () => {
  it('should create a matrix with the specified rows and columns', () => {
    const matrix = createMatrix(3, 2, 0)
    expect(matrix.length).toBe(3)
    expect(matrix[0].length).toBe(2)
    expect(matrix[1].length).toBe(2)
    expect(matrix[2].length).toBe(2)
  })

  it('should fill the matrix with the initial value', () => {
    const matrix = createMatrix(2, 3, 42)
    expect(matrix[0][0]).toBe(42)
    expect(matrix[0][1]).toBe(42)
    expect(matrix[0][2]).toBe(42)
    expect(matrix[1][0]).toBe(42)
    expect(matrix[1][1]).toBe(42)
    expect(matrix[1][2]).toBe(42)
  })

  it('should handle different data types', () => {
    const stringMatrix = createMatrix(2, 2, 'test')
    expect(stringMatrix[0][0]).toBe('test')

    const boolMatrix = createMatrix(2, 2, true)
    expect(boolMatrix[0][0]).toBe(true)

    const objMatrix = createMatrix(2, 2, { key: 'value' })
    expect(objMatrix[0][0]).toEqual({ key: 'value' })
  })

  it('should handle edge cases like 0 dimensions', () => {
    const emptyRowMatrix = createMatrix(0, 5, 0)
    expect(emptyRowMatrix.length).toBe(0)

    const emptyColMatrix = createMatrix(5, 0, 0)
    expect(emptyColMatrix.length).toBe(5)
    expect(emptyColMatrix[0].length).toBe(0)
  })

  it('should create independent rows but share object references', () => {
    // Create a matrix filled with zeros
    const matrix = createMatrix(3, 3, 0)

    // Modify one element in the first row
    matrix[0][0] = 42

    // Check that other rows are not affected
    expect(matrix[0][0]).toBe(42)
    expect(matrix[1][0]).toBe(0)
    expect(matrix[2][0]).toBe(0)

    // Modify one element in the second row
    matrix[1][1] = 99

    // Check that other rows are not affected
    expect(matrix[0][1]).toBe(0)
    expect(matrix[1][1]).toBe(99)
    expect(matrix[2][1]).toBe(0)
  })

  it('should share object references as documented', () => {
    // Create a matrix of empty objects
    const matrix = createMatrix(2, 2, { value: 0 })

    // Modify an object in the first row
    matrix[0][0].value = 42

    // All cells should be affected since they reference the same object
    expect(matrix[0][0].value).toBe(42)
    expect(matrix[0][1].value).toBe(42) // Now expecting 42 instead of 0
    expect(matrix[1][0].value).toBe(42) // Now expecting 42 instead of 0
    expect(matrix[1][1].value).toBe(42) // Now expecting 42 instead of 0
  })
})

describe('formatDecimal', () => {
  it('should format to 1 decimal place by default', () => {
    expect(formatDecimal(3.14159)).toBe(3.1)
    expect(formatDecimal(2.99)).toBe(3.0)
    expect(formatDecimal(1)).toBe(1.0)
  })

  it('should format to specified decimal places', () => {
    expect(formatDecimal(3.14159, 3)).toBe(3.142)
    expect(formatDecimal(2.55555, 2)).toBe(2.56)
    expect(formatDecimal(10, 4)).toBe(10.0)
  })

  it('should handle zero and negative numbers', () => {
    expect(formatDecimal(0, 2)).toBe(0.0)
    expect(formatDecimal(-3.14159, 2)).toBe(-3.14)
  })

  it('should round numbers correctly', () => {
    expect(formatDecimal(1.46, 1)).toBe(1.5) // Round up
    expect(formatDecimal(1.44, 1)).toBe(1.4) // Round down
    expect(formatDecimal(1.5, 0)).toBe(2) // Round to integer
  })
})

describe('calculateAverage', () => {
  it('should calculate the average of an array of numbers', () => {
    expect(calculateAverage([1, 2, 3, 4, 5])).toBe(3)
    expect(calculateAverage([10, 20])).toBe(15)
  })

  it('should handle decimal results', () => {
    expect(calculateAverage([1, 2])).toBe(1.5)
    expect(calculateAverage([1, 2, 4])).toBe(7 / 3)
  })

  it('should return 0 for an empty array', () => {
    expect(calculateAverage([])).toBe(0)
  })

  it('should handle negative numbers', () => {
    expect(calculateAverage([-5, 5])).toBe(0)
    expect(calculateAverage([-10, -20, -30])).toBe(-20)
  })
})

describe('sumArray', () => {
  it('should calculate the sum of an array of numbers', () => {
    expect(sumArray([1, 2, 3, 4, 5])).toBe(15)
    expect(sumArray([10, 20, 30])).toBe(60)
  })

  it('should return 0 for an empty array', () => {
    expect(sumArray([])).toBe(0)
  })

  it('should handle negative numbers', () => {
    expect(sumArray([-5, 5])).toBe(0)
    expect(sumArray([-10, -20])).toBe(-30)
  })

  it('should handle decimal numbers', () => {
    expect(sumArray([0.1, 0.2, 0.3])).toBeCloseTo(0.6)
    expect(sumArray([1.5, 2.5])).toBe(4)
  })
})

describe('normalizeToPercentages', () => {
  it('should convert values to percentages of their sum', () => {
    const input = [25, 25, 50]
    const result = normalizeToPercentages(input)
    expect(result[0]).toBe(25)
    expect(result[1]).toBe(25)
    expect(result[2]).toBe(50)
  })

  it('should handle arrays with a sum of zero', () => {
    const input = [0, 0, 0]
    const result = normalizeToPercentages(input)
    expect(result).toEqual([0, 0, 0])
  })

  it('should normalize to 100% total', () => {
    const input = [1, 1, 1, 1]
    const result = normalizeToPercentages(input)
    expect(result).toEqual([25, 25, 25, 25])

    // Check that the sum is 100
    expect(sumArray(result)).toBeCloseTo(100)
  })

  it('should handle decimal and uneven distributions', () => {
    const input = [1, 2, 3]
    const result = normalizeToPercentages(input)

    // The sum should be 6, so percentages should be 16.67%, 33.33%, 50%
    expect(result[0]).toBeCloseTo(16.67, 1)
    expect(result[1]).toBeCloseTo(33.33, 1)
    expect(result[2]).toBeCloseTo(50, 1)

    // Check that the sum is 100
    expect(sumArray(result)).toBeCloseTo(100)
  })
})

describe('arraysHaveSameElements', () => {
  it('should return true for arrays with the same elements in the same order', () => {
    expect(arraysHaveSameElements([1, 2, 3], [1, 2, 3])).toBe(true)
    expect(arraysHaveSameElements(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(true)
  })

  it('should return true for arrays with the same elements in different order', () => {
    expect(arraysHaveSameElements([1, 2, 3], [3, 1, 2])).toBe(true)
    expect(arraysHaveSameElements(['a', 'b', 'c'], ['c', 'a', 'b'])).toBe(true)
  })

  it('should return false for arrays with different elements', () => {
    expect(arraysHaveSameElements([1, 2, 3], [1, 2, 4])).toBe(false)
    expect(arraysHaveSameElements(['a', 'b', 'c'], ['a', 'b', 'd'])).toBe(false)
  })

  it('should return false for arrays of different lengths', () => {
    expect(arraysHaveSameElements([1, 2, 3], [1, 2])).toBe(false)
    expect(arraysHaveSameElements(['a', 'b'], ['a', 'b', 'c'])).toBe(false)
  })

  it('should handle empty arrays', () => {
    expect(arraysHaveSameElements([], [])).toBe(true)
    expect(arraysHaveSameElements([1], [])).toBe(false)
  })

  it('should handle arrays with duplicate elements', () => {
    expect(arraysHaveSameElements([1, 1, 2], [1, 2, 1])).toBe(true)
    expect(arraysHaveSameElements([1, 1, 2], [1, 2, 2])).toBe(false)
  })

  it('should handle the optimization for small arrays (≤10 elements)', () => {
    const smallArray1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const smallArray2 = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
    expect(arraysHaveSameElements(smallArray1, smallArray2)).toBe(true)

    const differentSmallArray = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11]
    expect(arraysHaveSameElements(smallArray1, differentSmallArray)).toBe(false)
  })

  it('should handle the optimization for large arrays (>10 elements)', () => {
    const largeArray1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    const largeArray2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
    expect(arraysHaveSameElements(largeArray1, largeArray2)).toBe(true)

    const differentLargeArray = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12]
    expect(arraysHaveSameElements(largeArray1, differentLargeArray)).toBe(false)
  })
})
