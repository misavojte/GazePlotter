import type { FixationEvent } from './dsl'

/**
 * Multiset equality: same elements regardless of order. This is visit mode's
 * "same AOI set" test; exported for its unit tests.
 */
export function arraysHaveSameElements<T>(
  arr1: readonly T[],
  arr2: readonly T[]
): boolean {
  if (arr1.length !== arr2.length) return false

  // For small arrays, sorting might be more efficient
  if (arr1.length <= 10) {
    // IMPORTANT: Use comparison function for numeric types to avoid string-sort bugs
    const sortedArr1 = [...arr1].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    const sortedArr2 = [...arr2].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

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

/** Shared accumulator + "from → to" detection for every transition metric;
 *  each supplies its own contribution via `processFixation`'s callback. */
export interface TransitionAcc {
  /** Side length of the square matrix (aoiCount + 1 — last row/col is outside-AOI). */
  size: number
  /** Primary flat row-major matrix (semantics depend on the metric). */
  matrix: Float64Array
  /** Optional companion matrix, e.g. counts alongside dwell-sum for mean-dwell. */
  auxMatrix: Float64Array | null
  prevIndices: number[]
  prevDuration: number
  fixationIndex: number
  /** Index of the outside-AOI slot (row/column); = aoiCount. */
  outsideSlot: number
}

export function initTransitionAcc(totalSlots: number, withAux = false): TransitionAcc {
  const aoiCount = totalSlots - 2
  const size = aoiCount + 1
  return {
    size,
    matrix: new Float64Array(size * size),
    auxMatrix: withAux ? new Float64Array(size * size) : null,
    prevIndices: [],
    prevDuration: 0,
    fixationIndex: 0,
    outsideSlot: aoiCount,
  }
}

/**
 * Advance the state machine by one fixation, calling `onTransition` once per
 * (prevIdx × currIdx) pair. In fixation mode every consecutive pair is a
 * transition; in visit mode same-AOI-set fixations merge, accumulating into
 * `prevDuration` until the set changes.
 */
export function processFixation(
  acc: TransitionAcc,
  fix: FixationEvent,
  mode: 'fixation' | 'visit',
  onTransition: (cellIdx: number, prevDuration: number) => void,
): void {
  const curr: number[] = fix.slots.length === 0 ? [acc.outsideSlot] : [...fix.slots]
  if (acc.fixationIndex > 0) {
    const isTransition = mode === 'fixation' || !arraysHaveSameElements(acc.prevIndices, curr)
    if (isTransition) {
      for (let pi = 0; pi < acc.prevIndices.length; pi++) {
        const from = acc.prevIndices[pi]
        const rowOffset = from * acc.size
        for (let c = 0; c < curr.length; c++) {
          onTransition(rowOffset + curr[c], acc.prevDuration)
        }
      }
    } else if (mode === 'visit') {
      acc.prevDuration += fix.duration
      return
    }
  }
  acc.prevIndices = curr
  acc.prevDuration = fix.duration
  acc.fixationIndex++
}

/** In-place matrix power via exponentiation-by-squaring (k ≥ 1). */
export function matrixPower(P: Float64Array, size: number, k: number): Float64Array {
  if (k <= 1) return P
  let base = P
  let exp = k
  let acc: Float64Array | null = null
  while (exp > 0) {
    if (exp % 2 === 1) acc = acc ? multiply(acc, base, size) : base
    if (exp > 1) base = multiply(base, base, size)
    exp = Math.floor(exp / 2)
  }
  return acc ?? P
}

function multiply(A: Float64Array, B: Float64Array, size: number): Float64Array {
  const C = new Float64Array(size * size)
  for (let i = 0; i < size; i++) {
    const iOffset = i * size
    for (let k = 0; k < size; k++) {
      const aik = A[iOffset + k]
      if (aik === 0) continue
      const kOffset = k * size
      for (let j = 0; j < size; j++) {
        C[iOffset + j] += aik * B[kOffset + j]
      }
    }
  }
  return C
}
