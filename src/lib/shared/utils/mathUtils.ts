/**
 * Matrix and mathematical utility functions for data transformation
 * Optimized for performance while maintaining clarity
 */

/**
 * Creates an array of specified length filled with initial value
 *
 * ⚠️ WARNING: When using object initialValues, all elements will reference the same object.
 * If you need independent object copies, use Array.from({ length }, () => ({ ...yourObj }))
 * or JSON.parse(JSON.stringify(obj)) for deep cloning.
 *
 * @param length Length of the array
 * @param initialValue Value to fill the array with
 * @returns A 1D array
 */
export function createArray<T>(length: number, initialValue: T): T[] {
  return new Array(length).fill(initialValue)
}

/**
 * Creates a 2D matrix of given dimensions filled with initial value
 *
 * ⚠️ WARNING: When using object initialValues, all cells will reference the same object.
 * If you need independent object copies, you should create the matrix with a primitive value
 * and then populate object cells individually, or use a more complex initialization pattern.
 *
 * @param rows Number of rows
 * @param cols Number of columns
 * @param initialValue Value to fill the matrix with (default: 0)
 * @returns A 2D matrix (array of arrays)
 */
export function createMatrix<T>(
  rows: number,
  cols: number,
  initialValue: T
): T[][] {
  // Create an array of rows, where each element will be an array of columns
  return Array.from({ length: rows }, () => createArray(cols, initialValue))
}

/**
 * Formats a number to a specific number of decimal places
 * Uses a rounding behavior that rounds 0.5 and above up
 *
 * @param value The number to format
 * @param decimalPlaces Number of decimal places (default: 1)
 * @returns Formatted number
 */
export function formatDecimal(
  value: number,
  decimalPlaces: number = 1
): number {
  const factor = Math.pow(10, decimalPlaces)
  return Math.round(value * factor) / factor
}

/**
 * Calculates the average of an array of numbers
 *
 * @param values Array of numeric values
 * @returns The average value, or 0 if array is empty
 */
export function calculateAverage(values: number[]): number {
  const length = values.length
  if (length === 0) return 0

  let sum = 0
  for (let i = 0; i < length; i++) {
    sum += values[i]
  }

  return sum / length
}

/**
 * Calculates the sum of values in an array
 *
 * @param values Array of numeric values
 * @returns The sum of all values
 */
export function sumArray(values: number[]): number {
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
  }
  return sum
}

/**
 * Normalizes an array of values to percentages of their sum
 *
 * @param values Array of numeric values
 * @returns Array of normalized values (percentages)
 */
export function normalizeToPercentages(values: number[]): number[] {
  const total = sumArray(values)
  if (total === 0) {
    // Avoid unnecessary iterations if total is zero
    return new Array(values.length).fill(0)
  }

  const result = new Array(values.length)
  for (let i = 0; i < values.length; i++) {
    result[i] = (values[i] / total) * 100
  }

  return result
}

/**
 * Checks if two arrays have the same elements (order doesn't matter)
 *
 * @param arr1 First array
 * @param arr2 Second array
 * @returns Boolean indicating if arrays have same elements
 */
export function arraysHaveSameElements<T>(arr1: T[], arr2: T[]): boolean {
  if (arr1.length !== arr2.length) return false

  // For small arrays, sorting might be more efficient
  if (arr1.length <= 10) {
    const sortedArr1 = [...arr1].sort()
    const sortedArr2 = [...arr2].sort()

    for (let i = 0; i < sortedArr1.length; i++) {
      if (sortedArr1[i] !== sortedArr2[i]) return false
    }

    return true
  }
  // For larger arrays, use a Map to avoid O(n²) comparison
  else {
    const countMap = new Map<T, number>()

    // Count occurrences in first array
    for (const item of arr1) {
      countMap.set(item, (countMap.get(item) || 0) + 1)
    }

    // Decrement counters for second array
    for (const item of arr2) {
      const count = countMap.get(item)
      if (count === undefined || count === 0) return false
      countMap.set(item, count - 1)
    }

    return true
  }
}
