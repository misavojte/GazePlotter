import type { RQAMetrics } from '../types'

/**
 * Compute RQA metrics from a flat NxN binary recurrence matrix.
 * Only the upper triangle (i < j) is considered (excluding diagonal i === j).
 */
export function computeRQA(
  matrix: Uint8Array,
  N: number,
  L: number
): RQAMetrics {
  if (N < 2) {
    return { R: 0, REC: 0, DET: 0, LAM: 0, CORM: 0 }
  }

  // R: sum of upper triangle (i < j)
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

  if (R === 0) {
    return { R: 0, REC: 0, DET: 0, LAM: 0, CORM: 0 }
  }

  // REC = 100 * 2R / (N * (N - 1))
  const REC = (200 * R) / (N * (N - 1))

  // DET: count points on diagonal lines of length >= L in upper triangle
  const DL = countDiagonalLinePoints(matrix, N, L)
  const DET = (100 * DL) / R

  // LAM: count points on horizontal + vertical lines of length >= L in upper triangle
  const { HL, VL } = countHorizontalVerticalLinePoints(matrix, N, L)
  const LAM = (100 * (HL + VL)) / (2 * R)

  // CORM = 100 * sum((j-i) * r_ij) / ((N-1) * R)
  const CORM = (100 * weightedDistanceSum) / ((N - 1) * R)

  return { R, REC, DET, LAM, CORM }
}

/**
 * Compute RQA metrics using duration-weighted matrix.
 */
export function computeRQAWithDuration(
  matrix: Uint8Array,
  durationMatrix: Float32Array,
  N: number,
  L: number,
  totalDuration: number
): RQAMetrics {
  if (N < 2 || totalDuration === 0) {
    return { R: 0, REC: 0, DET: 0, LAM: 0, CORM: 0 }
  }

  // R^t: sum of duration values in upper triangle
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

  if (Rt === 0) {
    return { R: 0, REC: 0, DET: 0, LAM: 0, CORM: 0 }
  }

  // REC^t = 100 * R^t / ((N-1) * T)
  const REC = (100 * Rt) / ((N - 1) * totalDuration)

  // DET^t: sum of duration values on diagonal lines of length >= L
  const DLt = sumDiagonalLineDurations(matrix, durationMatrix, N, L)
  const DET = (100 * DLt) / Rt

  // LAM^t: sum of duration values on horizontal + vertical lines of length >= L
  const { HLt, VLt } = sumHorizontalVerticalLineDurations(
    matrix,
    durationMatrix,
    N,
    L
  )
  const LAM = (100 * (HLt + VLt)) / (2 * Rt)

  // CORM^t = 100 * sum((j-i) * r^t_ij) / ((N-1)^2 * T)
  const CORM =
    (100 * weightedDistanceSum) / ((N - 1) * (N - 1) * totalDuration)

  return { R: Rt, REC, DET, LAM, CORM }
}

/**
 * Build a mask marking cells on diagonal lines of length >= L (upper triangle).
 * Mask[i*N+j] = 1 if the cell belongs to a qualifying diagonal run.
 */
export function buildDiagonalLineMask(
  matrix: Uint8Array,
  N: number,
  L: number
): Uint8Array {
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
          for (let s = runStart; s < runStart + runLength; s++) {
            mask[s * N + (s + k)] = 1
          }
        }
        runLength = 0
      }
    }
    if (runLength >= L) {
      for (let s = runStart; s < runStart + runLength; s++) {
        mask[s * N + (s + k)] = 1
      }
    }
  }

  return mask
}

/**
 * Build a mask marking cells on horizontal lines of length >= L (upper triangle).
 */
export function buildHorizontalLineMask(
  matrix: Uint8Array,
  N: number,
  L: number
): Uint8Array {
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
          for (let s = runStart; s < runStart + runLength; s++) {
            mask[rowOffset + s] = 1
          }
        }
        runLength = 0
      }
    }
    if (runLength >= L) {
      for (let s = runStart; s < runStart + runLength; s++) {
        mask[rowOffset + s] = 1
      }
    }
  }

  return mask
}

/**
 * Build a mask marking cells on vertical lines of length >= L (upper triangle).
 */
export function buildVerticalLineMask(
  matrix: Uint8Array,
  N: number,
  L: number
): Uint8Array {
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
          for (let s = runStart; s < runStart + runLength; s++) {
            mask[s * N + j] = 1
          }
        }
        runLength = 0
      }
    }
    if (runLength >= L) {
      for (let s = runStart; s < runStart + runLength; s++) {
        mask[s * N + j] = 1
      }
    }
  }

  return mask
}

/**
 * Count points that lie on diagonal lines of length >= L in the upper triangle.
 * Diagonal lines are parallel to the main diagonal (offset k = 1..N-1).
 */
function countDiagonalLinePoints(
  matrix: Uint8Array,
  N: number,
  L: number
): number {
  let count = 0

  for (let k = 1; k < N; k++) {
    let runLength = 0
    for (let i = 0; i + k < N; i++) {
      const j = i + k
      if (matrix[i * N + j]) {
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

/**
 * Count points on horizontal and vertical lines of length >= L in the upper triangle.
 */
function countHorizontalVerticalLinePoints(
  matrix: Uint8Array,
  N: number,
  L: number
): { HL: number; VL: number } {
  let HL = 0
  let VL = 0

  // Horizontal lines: for each row i, scan columns j > i
  for (let i = 0; i < N - 1; i++) {
    let runLength = 0
    const rowOffset = i * N
    for (let j = i + 1; j < N; j++) {
      if (matrix[rowOffset + j]) {
        runLength++
      } else {
        if (runLength >= L) HL += runLength
        runLength = 0
      }
    }
    if (runLength >= L) HL += runLength
  }

  // Vertical lines: for each column j, scan rows i < j
  for (let j = 1; j < N; j++) {
    let runLength = 0
    for (let i = 0; i < j; i++) {
      if (matrix[i * N + j]) {
        runLength++
      } else {
        if (runLength >= L) VL += runLength
        runLength = 0
      }
    }
    if (runLength >= L) VL += runLength
  }

  return { HL, VL }
}

/**
 * Sum duration values on diagonal lines of length >= L.
 */
function sumDiagonalLineDurations(
  matrix: Uint8Array,
  durationMatrix: Float32Array,
  N: number,
  L: number
): number {
  let total = 0

  for (let k = 1; k < N; k++) {
    let runLength = 0
    let runSum = 0
    for (let i = 0; i + k < N; i++) {
      const j = i + k
      const idx = i * N + j
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

/**
 * Sum duration values on horizontal and vertical lines of length >= L.
 */
function sumHorizontalVerticalLineDurations(
  matrix: Uint8Array,
  durationMatrix: Float32Array,
  N: number,
  L: number
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
