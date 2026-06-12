/**
 * Recurrence Quantification Analysis (RQA) primitives.
 *
 * Everything needed to compute RQA scalars and visualise recurrence plots:
 *   • scalar metrics from a binary recurrence matrix (both unweighted and
 *     duration-weighted);
 *   • scalar metrics directly from a categorical fixation sequence;
 *   • line masks for highlighting diagonal / horizontal / vertical runs.
 *
 * Consumers (sequence metrics, recurrence plot) import from here. Nothing in
 * this file depends on the plot layer.
 */

export interface RqaResult {
  /** Raw upper-triangle sum (count of recurrences, or duration sum if weighted). */
  R: number
  /** Recurrence rate (%). */
  REC: number
  /** Determinism (%): fraction of recurrent pairs on diagonal lines ≥ L. */
  DET: number
  /** Laminarity (%): fraction of recurrent pairs on horizontal/vertical lines ≥ L. */
  LAM: number
  /** Centre of recurrent mass (%): temporal concentration of recurrences. */
  CORM: number
}

const EMPTY: RqaResult = { R: 0, REC: 0, DET: 0, LAM: 0, CORM: 0 }

// ─── Scalar metrics from a binary recurrence matrix ─────────────────────────

/**
 * Compute RQA from a flat NxN binary recurrence matrix. Only the upper triangle
 * (i < j) is considered (excluding the main diagonal i === j).
 */
export function computeRqa(matrix: Uint8Array, N: number, minLineLength: number): RqaResult {
  if (N < 2) return EMPTY

  let R = 0
  let weightedDistanceSum = 0
  for (let i = 0; i < N - 1; i++) {
    const rowOffset = i * N
    for (let j = i + 1; j < N; j++) {
      if (matrix[rowOffset + j]) {
        R++
        weightedDistanceSum += j - i
      }
    }
  }

  if (R === 0) return EMPTY

  const REC = (200 * R) / (N * (N - 1))
  const DL = countDiagonalLinePoints(matrix, N, minLineLength)
  const DET = (100 * DL) / R
  const { HL, VL } = countHorizontalVerticalLinePoints(matrix, N, minLineLength)
  const LAM = (100 * (HL + VL)) / (2 * R)
  const CORM = (100 * weightedDistanceSum) / ((N - 1) * R)

  return { R, REC, DET, LAM, CORM }
}

/** Duration-weighted RQA: each recurrent cell contributes its duration instead of 1. */
export function computeRqaWithDuration(
  matrix: Uint8Array,
  durationMatrix: Float32Array,
  N: number,
  minLineLength: number,
  totalDuration: number,
): RqaResult {
  if (N < 2 || totalDuration === 0) return EMPTY

  let Rt = 0
  let weightedDistanceSum = 0
  for (let i = 0; i < N - 1; i++) {
    const rowOffset = i * N
    for (let j = i + 1; j < N; j++) {
      const val = durationMatrix[rowOffset + j]
      if (val > 0) {
        Rt += val
        weightedDistanceSum += (j - i) * val
      }
    }
  }

  if (Rt === 0) return EMPTY

  const REC = (100 * Rt) / ((N - 1) * totalDuration)
  const DLt = sumDiagonalLineDurations(matrix, durationMatrix, N, minLineLength)
  const DET = (100 * DLt) / Rt
  const { HLt, VLt } = sumHorizontalVerticalLineDurations(matrix, durationMatrix, N, minLineLength)
  const LAM = (100 * (HLt + VLt)) / (2 * Rt)
  const CORM = (100 * weightedDistanceSum) / ((N - 1) * (N - 1) * totalDuration)

  return { R: Rt, REC, DET, LAM, CORM }
}

// ─── Scalar metrics from a categorical sequence ─────────────────────────────

/**
 * Compute RQA from a categorical sequence (e.g. AOI slots). Two positions are
 * recurrent iff they share the same category. Returns null when the sequence
 * is too short to have any recurrence pairs.
 */
function computeRqaFromSequence(seq: readonly number[], minLineLength: number): RqaResult | null {
  const N = seq.length
  if (N < 2) return null
  const matrix = buildCategoricalRecurrenceMatrix(seq)
  return computeRqa(matrix, N, minLineLength)
}

/**
 * Evaluate RQA on a sequence, returning a single scalar selected by the caller.
 *   • Returns `Number.NaN` when the sequence is too short for any recurrence (N < 2).
 *   • Returns `scalarOnNoRecurrence` (default NaN) when the matrix has no recurrent
 *     pairs (R = 0) — the denominator-zero case for DET/LAM. REC callers pass 0
 *     because 0 recurrences = 0% recurrence rate.
 */
export function rqaScalar(
  seq: readonly number[],
  minLineLength: number,
  selector: (result: RqaResult) => number,
  scalarOnNoRecurrence: number = Number.NaN,
): number {
  const result = computeRqaFromSequence(seq, minLineLength)
  if (!result) return Number.NaN
  if (result.R === 0) return scalarOnNoRecurrence
  return selector(result)
}

/** Build a binary recurrence matrix from a categorical sequence (upper triangle only). */
function buildCategoricalRecurrenceMatrix(seq: readonly number[]): Uint8Array {
  const N = seq.length
  const matrix = new Uint8Array(N * N)
  for (let i = 0; i < N - 1; i++) {
    for (let j = i + 1; j < N; j++) {
      if (seq[i] === seq[j]) matrix[i * N + j] = 1
    }
  }
  return matrix
}

// ─── Line masks (used for recurrence-plot highlighting) ─────────────────────

/** Mark cells on diagonal lines of length ≥ L (upper triangle). */
export function buildDiagonalLineMask(matrix: Uint8Array, N: number, L: number): Uint8Array {
  const mask = new Uint8Array(N * N)
  for (let k = 1; k < N; k++) {
    let runStart = -1
    let runLength = 0
    for (let i = 0; i + k < N; i++) {
      const j = i + k
      if (matrix[i * N + j]) {
        if (runLength === 0) runStart = i
        runLength++
      } else {
        if (runLength >= L) {
          for (let s = runStart; s < runStart + runLength; s++) mask[s * N + (s + k)] = 1
        }
        runLength = 0
      }
    }
    if (runLength >= L) {
      for (let s = runStart; s < runStart + runLength; s++) mask[s * N + (s + k)] = 1
    }
  }
  return mask
}

/** Mark cells on horizontal lines of length ≥ L (upper triangle). */
export function buildHorizontalLineMask(matrix: Uint8Array, N: number, L: number): Uint8Array {
  const mask = new Uint8Array(N * N)
  for (let i = 0; i < N - 1; i++) {
    let runStart = -1
    let runLength = 0
    const rowOffset = i * N
    for (let j = i + 1; j < N; j++) {
      if (matrix[rowOffset + j]) {
        if (runLength === 0) runStart = j
        runLength++
      } else {
        if (runLength >= L) {
          for (let s = runStart; s < runStart + runLength; s++) mask[rowOffset + s] = 1
        }
        runLength = 0
      }
    }
    if (runLength >= L) {
      for (let s = runStart; s < runStart + runLength; s++) mask[rowOffset + s] = 1
    }
  }
  return mask
}

/** Mark cells on vertical lines of length ≥ L (upper triangle). */
export function buildVerticalLineMask(matrix: Uint8Array, N: number, L: number): Uint8Array {
  const mask = new Uint8Array(N * N)
  for (let j = 1; j < N; j++) {
    let runStart = -1
    let runLength = 0
    for (let i = 0; i < j; i++) {
      if (matrix[i * N + j]) {
        if (runLength === 0) runStart = i
        runLength++
      } else {
        if (runLength >= L) {
          for (let s = runStart; s < runStart + runLength; s++) mask[s * N + j] = 1
        }
        runLength = 0
      }
    }
    if (runLength >= L) {
      for (let s = runStart; s < runStart + runLength; s++) mask[s * N + j] = 1
    }
  }
  return mask
}

// ─── Internal helpers for the scalar computations ───────────────────────────

function countDiagonalLinePoints(matrix: Uint8Array, N: number, L: number): number {
  let count = 0
  for (let k = 1; k < N; k++) {
    let runLength = 0
    for (let i = 0; i + k < N; i++) {
      if (matrix[i * N + (i + k)]) {
        runLength++
      } else {
        if (runLength >= L) count += runLength
        runLength = 0
      }
    }
    if (runLength >= L) count += runLength
  }
  return count
}

function countHorizontalVerticalLinePoints(matrix: Uint8Array, N: number, L: number): { HL: number; VL: number } {
  let HL = 0
  let VL = 0

  for (let i = 0; i < N - 1; i++) {
    let runLength = 0
    const rowOffset = i * N
    for (let j = i + 1; j < N; j++) {
      if (matrix[rowOffset + j]) runLength++
      else {
        if (runLength >= L) HL += runLength
        runLength = 0
      }
    }
    if (runLength >= L) HL += runLength
  }

  for (let j = 1; j < N; j++) {
    let runLength = 0
    for (let i = 0; i < j; i++) {
      if (matrix[i * N + j]) runLength++
      else {
        if (runLength >= L) VL += runLength
        runLength = 0
      }
    }
    if (runLength >= L) VL += runLength
  }

  return { HL, VL }
}

function sumDiagonalLineDurations(
  matrix: Uint8Array,
  durationMatrix: Float32Array,
  N: number,
  L: number,
): number {
  let total = 0
  for (let k = 1; k < N; k++) {
    let runLength = 0
    let runSum = 0
    for (let i = 0; i + k < N; i++) {
      const idx = i * N + (i + k)
      if (matrix[idx]) {
        runLength++
        runSum += durationMatrix[idx]
      } else {
        if (runLength >= L) total += runSum
        runLength = 0
        runSum = 0
      }
    }
    if (runLength >= L) total += runSum
  }
  return total
}

function sumHorizontalVerticalLineDurations(
  matrix: Uint8Array,
  durationMatrix: Float32Array,
  N: number,
  L: number,
): { HLt: number; VLt: number } {
  let HLt = 0
  let VLt = 0

  for (let i = 0; i < N - 1; i++) {
    let runLength = 0
    let runSum = 0
    const rowOffset = i * N
    for (let j = i + 1; j < N; j++) {
      const idx = rowOffset + j
      if (matrix[idx]) {
        runLength++
        runSum += durationMatrix[idx]
      } else {
        if (runLength >= L) HLt += runSum
        runLength = 0
        runSum = 0
      }
    }
    if (runLength >= L) HLt += runSum
  }

  for (let j = 1; j < N; j++) {
    let runLength = 0
    let runSum = 0
    for (let i = 0; i < j; i++) {
      const idx = i * N + j
      if (matrix[idx]) {
        runLength++
        runSum += durationMatrix[idx]
      } else {
        if (runLength >= L) VLt += runSum
        runLength = 0
        runSum = 0
      }
    }
    if (runLength >= L) VLt += runSum
  }

  return { HLt, VLt }
}
