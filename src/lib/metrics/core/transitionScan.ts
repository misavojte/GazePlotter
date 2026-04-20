import { arraysHaveSameElements } from '$lib/shared/utils/mathUtils'
import type { FixationEvent } from './dsl'

/**
 * Shared accumulator + scan helper for all transition-based aoi-pair-matrix
 * metrics (count, relative-frequency, probability, dwell-sum, dwell-mean).
 *
 * All of them share the same "from → to" detection logic across fixation /
 * visit modes. Each metric supplies its own per-transition contribution via
 * the `onTransition` callback in `processFixation`.
 */
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
 * Advance the transition state machine by one fixation. Calls `onTransition`
 * exactly once per (prevIdx × currIdx) pair whenever a transition is detected.
 *
 * In fixation mode, every consecutive fixation pair is a transition.
 * In visit mode, consecutive same-AOI-set fixations merge into one visit —
 * their durations accumulate into `prevDuration`, and no transition fires
 * until the AOI set changes.
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
