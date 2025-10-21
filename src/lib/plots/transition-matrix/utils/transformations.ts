/**
 * Transition Matrix Data Transformation Utilities
 *
 * This module contains pure functions for transforming eye tracking data
 * into transition matrices for AOI (Areas of Interest) analysis.
 *
 * The transformation process:
 * 1. Retrieves AOIs and participants for a stimulus and group
 * 2. Processes fixation segments to identify transitions between AOIs
 * 3. Generates a matrix showing transition frequencies between AOIs
 */

import {
  getParticipants,
  getAois,
  getSegments,
  getNumberOfSegments,
} from '$lib/gaze-data/front-process/stores/dataStore'
import type { SegmentInterpretedDataType } from '$lib/gaze-data/shared/types'
import {
  createMatrix,
  formatDecimal,
  sumArray,
  arraysHaveSameElements,
} from '$lib/shared/utils/mathUtils'

import { AggregationMethod } from '$lib/plots/transition-matrix/const'
import type { TransitionMatrixData } from '$lib/plots/transition-matrix/types'

/**
 * Calculates the transition matrix between AOIs for the specified stimulus and group
 *
 * @param stimulusId ID of the stimulus to analyze
 * @param groupId ID of the participant group (-1 for all participants)
 * @param aggregationMethod Method to use for aggregating participant data (default: SUM)
 * @returns Object containing the transition matrix, AOI labels, and AOI list
 */
export function calculateTransitionMatrix(
  stimulusId: number,
  groupId: number,
  aggregationMethod: AggregationMethod = AggregationMethod.SUM
): TransitionMatrixData {
  console.log(
    `Starting transition matrix calculation for stimulusId=${stimulusId}, groupId=${groupId}`
  )

  if (aggregationMethod === AggregationMethod.SEGMENT_DWELL_TIME) {
    return calculateSegmentDwellTimeMatrix(stimulusId, groupId)
  }

  // Get participants for the selected group and stimulus
  const participants = getParticipants(groupId, stimulusId)
  const participantIds = participants.map(participant => participant.id)
  // console.log(`Found ${participantIds.length} participants:`, participantIds)

  // Get AOIs for the current stimulus
  const aoiList = getAois(stimulusId)
  // console.log(
  //   `Found ${aoiList.length} AOIs:`,
  //   aoiList.map(aoi => aoi.displayedName)
  // )

  // Add "NO AOI" as the last item
  const aoiLabels = [...aoiList.map(aoi => aoi.displayedName), 'NO AOI']

  // Matrix size including the "NO AOI" category
  const matrixSize = aoiList.length + 1
  const outsideAoiIndex = aoiList.length // Index for "NO AOI"
  // console.log(
  //   `Matrix size will be ${matrixSize}x${matrixSize} (including NO AOI)`
  // )

  if (participantIds.length === 0) {
    // console.log('No participants found, returning empty matrix')
    const emptyMatrix = createMatrix(matrixSize, matrixSize, 0)
    return { matrix: emptyMatrix, aoiLabels, aoiList }
  }

  // Create an array to store individual participant matrices for averaging/median
  const participantMatrices: number[][][] = []
  let totalTransitionsFound = 0

  // Add to the main function, before the participant loop
  const dwellTimeData: DwellTimeData = {}

  // Process each participant's data
  for (const participantId of participantIds) {
    // console.log(`\nProcessing participant ${participantId}`)

    // Initialize a matrix for this participant
    const participantMatrix = createMatrix(matrixSize, matrixSize, 0)

    const segmentCount = getNumberOfSegments(stimulusId, participantId)
    // console.log(`  Participant has ${segmentCount} segments`)

    // Skip if no segments or only one segment
    if (segmentCount <= 1) {
      // console.log('  Skipping participant with <= 1 segments')
      participantMatrices.push(participantMatrix)
      continue
    }

    let participantTransitions = 0

    // Get all fixation segments for this participant efficiently
    // Filter for only fixations (category.id === 0)
    const allSegments = getSegments(stimulusId, participantId, [0])

    // Process transitions between fixation segments
    let lastFixation: SegmentInterpretedDataType | null = null
    for (const currentSegment of allSegments) {
      // If we have a previous fixation, record a transition
      if (lastFixation !== null) {
        // Determine the "from" AOI indices
        const fromIndices: number[] = []
        if (lastFixation.aoi.length === 0) {
          // If no AOIs, mark as "NO AOI"
          fromIndices.push(outsideAoiIndex)
        } else {
          // Otherwise add all AOIs that were hit
          for (const aoi of lastFixation.aoi) {
            const index = aoiList.findIndex(a => a.id === aoi.id)
            if (index !== -1) {
              fromIndices.push(index)
            }
          }
        }

        // Determine the "to" AOI indices
        const toIndices: number[] = []
        if (currentSegment.aoi.length === 0) {
          // If no AOIs, mark as "NO AOI"
          toIndices.push(outsideAoiIndex)
        } else {
          // Otherwise add all AOIs that were hit
          for (const aoi of currentSegment.aoi) {
            const index = aoiList.findIndex(a => a.id === aoi.id)
            if (index !== -1) {
              toIndices.push(index)
            }
          }
        }

        // Record all transitions between "from" and "to" AOIs
        for (const fromIdx of fromIndices) {
          for (const toIdx of toIndices) {
            participantMatrix[fromIdx][toIdx]++
            participantTransitions++
          }
        }

        // For dwell time calculation, we need the duration of the lastFixation
        const fixationDuration = lastFixation.end - lastFixation.start

        // Record dwell time for each transition
        for (const fromIdx of fromIndices) {
          for (const toIdx of toIndices) {
            // Initialize nested objects if they don't exist
            if (!dwellTimeData[fromIdx]) dwellTimeData[fromIdx] = {}
            if (!dwellTimeData[fromIdx][toIdx]) {
              dwellTimeData[fromIdx][toIdx] = { totalTime: 0, count: 0 }
            }

            // Add this fixation's duration to the total
            dwellTimeData[fromIdx][toIdx].totalTime += fixationDuration
            dwellTimeData[fromIdx][toIdx].count++
          }
        }
      }

      // Update lastFixation for the next iteration
      lastFixation = currentSegment
    }
    totalTransitionsFound += participantTransitions

    // Add this participant's matrix to our collection
    participantMatrices.push(participantMatrix)
  }

  // console.log(
  //   `\nTotal transitions found across all participants: ${totalTransitionsFound}`
  // )

  // Aggregate the matrices based on the selected method
  let resultMatrix: number[][]

  switch (aggregationMethod) {
    case AggregationMethod.FREQUENCY_RELATIVE:
      // Calculate relative frequency: percentage of all transitions
      resultMatrix = calculateRelativeFrequencyMatrix(
        calculateSumMatrix(participantMatrices)
      )
      break
    case AggregationMethod.PROBABILITY:
      // First calculate the sum matrix, then normalize by row
      resultMatrix = calculateTransitionProbabilityMatrix(
        calculateSumMatrix(participantMatrices)
      )
      break
    case AggregationMethod.PROBABILITY_2:
      // 2-step transition probability: P^2
      resultMatrix = calculateKStepProbabilityMatrix(participantMatrices, 2)
      break
    case AggregationMethod.PROBABILITY_3:
      // 3-step transition probability: P^3
      resultMatrix = calculateKStepProbabilityMatrix(participantMatrices, 3)
      break
    case AggregationMethod.DWELL_TIME:
      // For dwell time, we need to calculate additional data during processing
      resultMatrix = calculateDwellTimeMatrix(
        participantMatrices,
        dwellTimeData
      )
      break
    case AggregationMethod.SUM:
    default:
      resultMatrix = calculateSumMatrix(participantMatrices)
      break
  }

  return { matrix: resultMatrix, aoiLabels, aoiList }
}

/**
 * Multiplies two square matrices A and B
 *
 * Performs standard matrix multiplication: C[i,j] = Σ(A[i,k] × B[k,j])
 * Used as building block for matrix exponentiation.
 *
 * @param matrixA First matrix (n×n)
 * @param matrixB Second matrix (n×n)
 * @returns Product matrix A × B (n×n)
 */
function multiplyMatrices(matrixA: number[][], matrixB: number[][]): number[][] {
  const n = matrixA.length
  const result = createMatrix(n, n, 0)

  // Standard matrix multiplication: C[i,j] = sum over k of A[i,k] * B[k,j]
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0
      for (let k = 0; k < n; k++) {
        sum += matrixA[i][k] * matrixB[k][j]
      }
      result[i][j] = sum
    }
  }

  return result
}

/**
 * Raises a matrix to a positive integer power using fast exponentiation
 *
 * Uses the square-and-multiply algorithm for efficient computation:
 * - P^8 = ((P^2)^2)^2 requires only 3 multiplications instead of 7
 * - Time complexity: O(n³ log k) where n is matrix dimension and k is the power
 *
 * @param matrix Square matrix to raise to power (n×n)
 * @param power Positive integer exponent (k ≥ 1)
 * @returns Matrix raised to the k-th power (n×n)
 */
function matrixPower(matrix: number[][], power: number): number[][] {
  if (power < 1) {
    throw new Error('Power must be a positive integer')
  }

  const n = matrix.length

  // Base case: P^1 = P
  if (power === 1) {
    return matrix.map(row => [...row])
  }

  // For P^2, just multiply once
  if (power === 2) {
    return multiplyMatrices(matrix, matrix)
  }

  // Fast exponentiation using square-and-multiply algorithm
  // Example: P^5 = P^4 × P^1 = (P^2)^2 × P
  let result = createMatrix(n, n, 0)
  // Initialize result as identity matrix
  for (let i = 0; i < n; i++) {
    result[i][i] = 1
  }

  let base = matrix.map(row => [...row]) // Copy the matrix
  let exp = power

  // Binary exponentiation loop
  while (exp > 0) {
    // If current bit is 1, multiply result by current base
    if (exp % 2 === 1) {
      result = multiplyMatrices(result, base)
    }
    // Square the base for next bit
    base = multiplyMatrices(base, base)
    // Move to next bit
    exp = Math.floor(exp / 2)
  }

  return result
}

/**
 * Normalizes each row of a matrix to sum to 1.0 (or 0 if row was empty)
 *
 * Converts a count matrix to a row-stochastic probability matrix where
 * each row represents a probability distribution over destination AOIs.
 * Handles floating-point drift by ensuring each non-zero row sums exactly to 1.
 *
 * @param matrix Matrix to normalize (n×n)
 * @returns Row-normalized matrix where each row sums to 1.0 (n×n)
 */
function rowNormalizeMatrix(matrix: number[][]): number[][] {
  const n = matrix.length
  const result = createMatrix(n, n, 0)

  // Normalize each row independently
  for (let i = 0; i < n; i++) {
    const rowSum = sumArray(matrix[i])

    // If row sum is 0, keep row as zeros (no transitions from this AOI)
    if (rowSum === 0) continue

    // Normalize: divide each element by row sum to get probabilities
    for (let j = 0; j < n; j++) {
      result[i][j] = matrix[i][j] / rowSum
    }
  }

  return result
}

/**
 * Renormalizes each row to counter floating-point drift after matrix operations
 *
 * After repeated matrix multiplications, rows may not sum exactly to 1.0
 * due to accumulated floating-point errors. This function redistributes
 * any error proportionally across non-zero elements.
 *
 * @param matrix Probability matrix to renormalize (n×n)
 * @returns Renormalized matrix with rows summing to exactly 1.0 (n×n)
 */
function renormalizeRows(matrix: number[][]): number[][] {
  const n = matrix.length
  const result = createMatrix(n, n, 0)

  for (let i = 0; i < n; i++) {
    const rowSum = sumArray(matrix[i])

    // If row is all zeros, keep it that way
    if (rowSum === 0) continue

    // Renormalize to ensure sum equals 1.0
    for (let j = 0; j < n; j++) {
      result[i][j] = matrix[i][j] / rowSum
    }
  }

  return result
}

/**
 * Calculates k-step transition probabilities using matrix exponentiation
 *
 * Given a count matrix N, computes P^k where P is the row-normalized
 * probability matrix. The result shows the probability of reaching each
 * destination AOI after exactly k transitions from each source AOI.
 *
 * Example interpretations:
 * - k=1: Direct transitions (current behavior)
 * - k=2: Probability via one intermediate AOI (i→x→j patterns)
 * - k=3: Probability via two intermediate AOIs (i→x→y→j patterns)
 *
 * @param participantMatrices Array of per-participant count matrices
 * @param k Number of transition steps (positive integer)
 * @param asPercent If true, return values as percentages (0-100); else probabilities (0-1)
 * @returns k-step probability matrix
 */
function calculateKStepProbabilityMatrix(
  participantMatrices: number[][][],
  k: number,
  asPercent: boolean = true
): number[][] {
  // Step 1: Sum all participant matrices to get aggregate count matrix N
  const countMatrix = calculateSumMatrix(participantMatrices)

  // Step 2: Row-normalize to get 1-step probability matrix P
  const probabilityMatrix = rowNormalizeMatrix(countMatrix)

  // Step 3: Compute P^k using fast exponentiation
  const kStepMatrix = matrixPower(probabilityMatrix, k)

  // Step 4: Renormalize to counter floating-point drift
  const renormalized = renormalizeRows(kStepMatrix)

  // Step 5: Convert to percentage if requested
  if (asPercent) {
    const n = renormalized.length
    const result = createMatrix(n, n, 0)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        // Convert to percentage and format to avoid excessive decimal places
        result[i][j] = formatDecimal(renormalized[i][j] * 100)
      }
    }
    return result
  }

  return renormalized
}

/**
 * Calculates the sum of all participant matrices
 *
 * @param matrices Array of participant matrices
 * @returns A new matrix with summed values
 */
function calculateSumMatrix(matrices: number[][][]): number[][] {
  if (matrices.length === 0) return []

  const rows = matrices[0].length
  const cols = matrices[0][0].length

  // Initialize result matrix with zeros
  const result = createMatrix(rows, cols, 0)

  // Sum up all matrices
  for (const matrix of matrices) {
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        result[i][j] += matrix[i][j]
      }
    }
  }

  return result
}

/**
 * Calculates relative frequency across the entire matrix
 * 
 * Normalizes all transitions by the total count across the entire matrix,
 * showing what percentage of all transitions each cell represents.
 * Unlike probability (row-normalized), this shows the global distribution.
 *
 * @param matrix The transition count matrix
 * @returns A new matrix with relative frequency percentages (0-100)
 */
function calculateRelativeFrequencyMatrix(matrix: number[][]): number[][] {
  // Create a new matrix of the same size
  const result = createMatrix(matrix.length, matrix[0].length, 0)

  // Calculate the total number of transitions across entire matrix
  const totalTransitions = getTotalTransitions(matrix)

  // If no transitions at all, return empty matrix
  if (totalTransitions === 0) return result

  // Calculate relative frequency for each cell as percentage of total
  for (let i = 0; i < matrix.length; i++) {
    for (let j = 0; j < matrix[i].length; j++) {
      // Convert to percentage of total transitions
      result[i][j] = formatDecimal((matrix[i][j] / totalTransitions) * 100)
    }
  }

  return result
}

/**
 * Calculates transition probabilities for each origin AOI
 * This normalizes each row of the matrix so the sum equals 1 (100%)
 *
 * @param matrix The transition count matrix
 * @returns A new matrix with normalized probability values (0-1)
 */
function calculateTransitionProbabilityMatrix(matrix: number[][]): number[][] {
  // Create a new matrix of the same size
  const result = createMatrix(matrix.length, matrix[0].length, 0)

  // Process each row (source AOI)
  for (let i = 0; i < matrix.length; i++) {
    // Calculate the total transitions from this AOI
    const rowSum = sumArray(matrix[i])

    // If no transitions from this AOI, leave as zeros
    if (rowSum === 0) continue

    // Calculate the probability for each transition
    for (let j = 0; j < matrix[i].length; j++) {
      // Convert to percentage
      result[i][j] = formatDecimal((matrix[i][j] / rowSum) * 100)
    }
  }

  return result
}

/**
 * Calculates the average dwell time before transitions between AOIs
 *
 * Note: This is a more advanced calculation that requires tracking
 * fixation durations during the initial data processing phase.
 *
 * @param matrices Array of participant matrices
 * @param dwellTimeData Collected dwell time data during processing
 * @returns A matrix with average dwell times
 */
interface DwellTimeData {
  [fromIdx: number]: {
    [toIdx: number]: {
      totalTime: number
      count: number
    }
  }
}

function calculateDwellTimeMatrix(
  matrices: number[][][],
  dwellTimeData: DwellTimeData
): number[][] {
  // Create a matrix of the same size as our transition matrices
  const rows = matrices[0].length
  const cols = matrices[0][0].length

  const result = createMatrix(rows, cols, 0)

  // Calculate average dwell time for each transition
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (
        dwellTimeData[i] &&
        dwellTimeData[i][j] &&
        dwellTimeData[i][j].count > 0
      ) {
        result[i][j] = formatDecimal(
          dwellTimeData[i][j].totalTime / dwellTimeData[i][j].count
        )
      }
    }
  }

  return result
}

/**
 * Gets the total number of transitions in a transition matrix
 *
 * @param matrix The transition matrix to analyze
 * @returns Total number of transitions
 */
export function getTotalTransitions(matrix: number[][]): number {
  let total = 0
  for (let i = 0; i < matrix.length; i++) {
    total += sumArray(matrix[i])
  }
  return total
}

/**
 * Normalizes a transition matrix to show percentages instead of counts
 *
 * @param matrix The transition matrix to normalize
 * @returns A new matrix with normalized values (percentages)
 */
export function normalizeTransitionMatrix(matrix: number[][]): number[][] {
  const total = getTotalTransitions(matrix)
  if (total === 0) return matrix.map(row => [...row])

  const result = createMatrix(matrix.length, matrix[0].length, 0)

  for (let i = 0; i < matrix.length; i++) {
    for (let j = 0; j < matrix[i].length; j++) {
      result[i][j] = (matrix[i][j] / total) * 100
    }
  }

  return result
}

/**
 * Calculate segment-based dwell time transition matrix
 *
 * This function analyzes consecutive fixations within the same AOI(s) to calculate
 * average dwell time for segments before transitions. For example, if the sequence
 * is A, A, A, A, B, it will sum the duration of each individual A fixation (end-start)
 * before the transition to B. This means it measures the total time spent
 * on a set of AOIs
 * by summing the actual durations of each fixation before transitioning to a different set of AOIs.
 *
 * The dwell time is calculated by summing the individual fixation durations (end-start) of
 * consecutive fixations on the same AOI(s). This ensures we capture the actual time spent
 * on each fixation before any transition occurs.
 *
 * @param stimulusId ID of the stimulus to analyze
 * @param groupId ID of the participant group (-1 for all participants)
 * @returns Object containing the segment dwell time matrix, AOI labels, and AOI list
 */
export function calculateSegmentDwellTimeMatrix(
  stimulusId: number,
  groupId: number
): TransitionMatrixData {
  // Get participants for the selected group and stimulus
  const participants = getParticipants(groupId, stimulusId)
  const participantIds = participants.map(participant => participant.id)

  // Get AOIs for the current stimulus
  const aoiList = getAois(stimulusId)

  // Add "NO AOI" as the last item
  const aoiLabels = [...aoiList.map(aoi => aoi.displayedName), 'NO AOI']

  // Matrix size including the "NO AOI" category
  const matrixSize = aoiList.length + 1
  const outsideAoiIndex = aoiList.length // Index for "NO AOI"

  if (participantIds.length === 0) {
    const emptyMatrix = createMatrix(matrixSize, matrixSize, 0)
    return { matrix: emptyMatrix, aoiLabels, aoiList }
  }

  // Data structure for segment dwell time tracking
  const segmentDwellTimeData: {
    [fromIdx: number]: {
      [toIdx: number]: { totalTime: number; count: number }
    }
  } = {}

  // Process each participant's data
  for (const participantId of participantIds) {
    const segmentCount = getNumberOfSegments(stimulusId, participantId)

    // Skip if no segments or only one segment
    if (segmentCount <= 1) continue

    // Get all fixation segments for this participant efficiently
    // Filter for only fixations (category.id === 0)
    const fixationSegments = getSegments(stimulusId, participantId, [0])

    // For segment-based dwell time tracking
    let currentAoiIndices: number[] = []
    let currentSegmentTotalDuration = 0
    let isTrackingSegment = false

    // Process fixation segments
    for (const currentSegment of fixationSegments) {
      // Get current AOI indices
      const aoiIndices: number[] = []
      if (currentSegment.aoi.length === 0) {
        aoiIndices.push(outsideAoiIndex)
      } else {
        for (const aoi of currentSegment.aoi) {
          const index = aoiList.findIndex(a => a.id === aoi.id)
          if (index !== -1) {
            aoiIndices.push(index)
          }
        }
      }

      // If we haven't started tracking a segment yet
      if (!isTrackingSegment) {
        currentAoiIndices = [...aoiIndices]
        currentSegmentTotalDuration = currentSegment.end - currentSegment.start
        isTrackingSegment = true
      }
      // If AOIs changed, record the segment and start a new one
      else if (!arraysHaveSameElements(currentAoiIndices, aoiIndices)) {
        // Record segment dwell time for each transition
        for (const fromIdx of currentAoiIndices) {
          for (const toIdx of aoiIndices) {
            // Initialize nested objects if they don't exist
            if (!segmentDwellTimeData[fromIdx])
              segmentDwellTimeData[fromIdx] = {}
            if (!segmentDwellTimeData[fromIdx][toIdx]) {
              segmentDwellTimeData[fromIdx][toIdx] = { totalTime: 0, count: 0 }
            }

            // Add this segment's total duration to the total
            segmentDwellTimeData[fromIdx][toIdx].totalTime +=
              currentSegmentTotalDuration
            segmentDwellTimeData[fromIdx][toIdx].count++
          }
        }

        // Start new segment
        currentAoiIndices = [...aoiIndices]
        currentSegmentTotalDuration = currentSegment.end - currentSegment.start
      }
      // If same AOI, add this fixation's duration to the current segment
      else {
        currentSegmentTotalDuration += currentSegment.end - currentSegment.start
      }
    }
  }

  // Initialize result matrix with zeros
  const resultMatrix = createMatrix(matrixSize, matrixSize, 0)

  // Calculate average dwell time for each transition
  for (let i = 0; i < matrixSize; i++) {
    for (let j = 0; j < matrixSize; j++) {
      if (
        segmentDwellTimeData[i] &&
        segmentDwellTimeData[i][j] &&
        segmentDwellTimeData[i][j].count > 0
      ) {
        resultMatrix[i][j] = formatDecimal(
          segmentDwellTimeData[i][j].totalTime /
            segmentDwellTimeData[i][j].count
        )
      }
    }
  }

  return { matrix: resultMatrix, aoiLabels, aoiList }
}

/**
 * ============================================================================
 * K-STEP TRANSITION PROBABILITY - MATHEMATICAL VERIFICATION EXAMPLE
 * ============================================================================
 *
 * To verify the implementation is correct, consider a simple 3-AOI example:
 *
 * Count Matrix N:
 * From\To   A    B    C
 * A        [2,   3,   1]   (row sum = 6)
 * B        [1,   0,   2]   (row sum = 3)
 * C        [2,   1,   0]   (row sum = 3)
 *
 * 1-Step Probability Matrix P (each row normalized):
 * From\To      A        B        C
 * A        [0.333,  0.500,  0.167]   (2/6, 3/6, 1/6)
 * B        [0.333,  0.000,  0.667]   (1/3, 0/3, 2/3)
 * C        [0.667,  0.333,  0.000]   (2/3, 1/3, 0/3)
 *
 * Interpretation: If starting at A, there's 50% chance next transition goes to B
 *
 * 2-Step Probability Matrix P² = P × P:
 * Calculation example for P²[A,B] (starting at A, ending at B after 2 steps):
 *   = P[A,A]×P[A,B] + P[A,B]×P[B,B] + P[A,C]×P[C,B]
 *   = 0.333×0.500 + 0.500×0.000 + 0.167×0.333
 *   = 0.167 + 0.000 + 0.056
 *   = 0.223 (22.3%)
 *
 * This means: Starting at A, there's 22.3% probability to be at B after 2 transitions
 * (considering all possible intermediate paths: A→A→B, A→B→B, A→C→B)
 *
 * 3-Step Probability Matrix P³ = P² × P:
 * Calculated similarly by multiplying P² by P
 *
 * Key Properties:
 * - Each row of P^k sums to ~1.0 (row-stochastic)
 * - Diagonal values decrease as k increases (less likely to return)
 * - Off-diagonal values converge to steady state as k → ∞
 * - Fast exponentiation makes P^k efficient even for large k
 * ============================================================================
 */
