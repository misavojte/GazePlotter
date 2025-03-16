/**
 * AOI Transition Matrix Data Transformation Utilities
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
  getSegment,
  getNumberOfSegments,
} from '$lib/stores/dataStore'
import type { ExtendedInterpretedDataType } from '$lib/type/Data/InterpretedData/ExtendedInterpretedDataType'
import type { SegmentInterpretedDataType } from '$lib/type/Data/InterpretedData/SegmentInterpretedDataType'
/**
 * Defines available aggregation methods for transition matrices
 */
export enum AggregationMethod {
  SUM = 'sum',
  PROBABILITY = 'probability',
  DWELL_TIME = 'dwellTime',
}

/**
 * Interface representing an AOI transition matrix with labels
 */
export interface AoiTransitionMatrixData {
  matrix: number[][]
  aoiLabels: string[]
  aoiList: ExtendedInterpretedDataType[]
}

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
): AoiTransitionMatrixData {
  console.log(
    `Starting transition matrix calculation for stimulusId=${stimulusId}, groupId=${groupId}`
  )

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
    const emptyMatrix = Array(matrixSize)
      .fill(0)
      .map(() => Array(matrixSize).fill(0))
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
    const participantMatrix = Array(matrixSize)
      .fill(0)
      .map(() => Array(matrixSize).fill(0))

    const segmentCount = getNumberOfSegments(stimulusId, participantId)
    // console.log(`  Participant has ${segmentCount} segments`)

    // Skip if no segments or only one segment
    if (segmentCount <= 1) {
      // console.log('  Skipping participant with <= 1 segments')
      participantMatrices.push(participantMatrix)
      continue
    }

    let participantTransitions = 0

    let lastFixation: SegmentInterpretedDataType | null = null
    // Process transitions between fixation segments
    for (let i = 0; i < segmentCount; i++) {
      const currentSegment = getSegment(stimulusId, participantId, i)

      // Only consider FIXATIONS (category.id === 0)
      if (currentSegment.category.id !== 0) {
        // console.log(
        //   `  Segment ${i}: Not a fixation (category=${currentSegment.category.id}), skipping`
        // )
        continue
      }

      // console.log(
      //   `  Segment ${i}: Fixation found (category=${currentSegment.category.id}, AOIs=${currentSegment.aoi.map(a => a.id).join(',')})`
      // )

      // If we have a previous fixation, record a transition
      if (lastFixation !== null) {
        // console.log(`  Processing transition: segment ${i - 1} -> segment ${i}`)

        // Determine the "from" AOI indices
        const fromIndices: number[] = []
        if (lastFixation.aoi.length === 0) {
          // If no AOIs, mark as "NO AOI"
          fromIndices.push(outsideAoiIndex)
          // console.log(`    From: NO AOI (${outsideAoiIndex})`)
        } else {
          // Otherwise add all AOIs that were hit
          for (const aoi of lastFixation.aoi) {
            const index = aoiList.findIndex(a => a.id === aoi.id)
            if (index !== -1) {
              fromIndices.push(index)
              // console.log(`    From: AOI ${aoi.id} (index ${index})`)
            }
          }
        }

        // Determine the "to" AOI indices
        const toIndices: number[] = []
        if (currentSegment.aoi.length === 0) {
          // If no AOIs, mark as "NO AOI"
          toIndices.push(outsideAoiIndex)
          // console.log(`    To: NO AOI (${outsideAoiIndex})`)
        } else {
          // Otherwise add all AOIs that were hit
          for (const aoi of currentSegment.aoi) {
            const index = aoiList.findIndex(a => a.id === aoi.id)
            if (index !== -1) {
              toIndices.push(index)
              // console.log(`    To: AOI ${aoi.id} (index ${index})`)
            }
          }
        }

        // Record all transitions between "from" and "to" AOIs
        for (const fromIdx of fromIndices) {
          for (const toIdx of toIndices) {
            participantMatrix[fromIdx][toIdx]++
            participantTransitions++
            // console.log(`    Recorded transition: ${fromIdx} -> ${toIdx}`)
          }
        }

        // For dwell time calculation, we need the duration of the lastFixation
        const fixationDuration = currentSegment.end - currentSegment.start

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
    case AggregationMethod.PROBABILITY:
      // First calculate the sum matrix, then normalize by row
      resultMatrix = calculateTransitionProbabilityMatrix(
        calculateSumMatrix(participantMatrices)
      )
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

  // Log the total transitions in the final matrix
  const totalInFinalMatrix = resultMatrix.reduce(
    (sum, row) => sum + row.reduce((rowSum, cell) => rowSum + cell, 0),
    0
  )
  // console.log(`Total value in final matrix: ${totalInFinalMatrix}`)

  return { matrix: resultMatrix, aoiLabels, aoiList }
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
  const result = Array(rows)
    .fill(0)
    .map(() => Array(cols).fill(0))

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
 * Calculates transition probabilities for each origin AOI
 * This normalizes each row of the matrix so the sum equals 1 (100%)
 *
 * @param matrix The transition count matrix
 * @returns A new matrix with normalized probability values (0-1)
 */
function calculateTransitionProbabilityMatrix(matrix: number[][]): number[][] {
  // Create a new matrix of the same size
  const result = Array(matrix.length)
    .fill(0)
    .map((_, i) => Array(matrix[0].length).fill(0))

  // Process each row (source AOI)
  for (let i = 0; i < matrix.length; i++) {
    // Calculate the total transitions from this AOI
    const rowSum = matrix[i].reduce((sum, value) => sum + value, 0)

    // If no transitions from this AOI, leave as zeros
    if (rowSum === 0) continue

    // Calculate the probability for each transition
    for (let j = 0; j < matrix[i].length; j++) {
      result[i][j] = matrix[i][j] / rowSum
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

  const result = Array(rows)
    .fill(0)
    .map(() => Array(cols).fill(0))

  // Calculate average dwell time for each transition
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (
        dwellTimeData[i] &&
        dwellTimeData[i][j] &&
        dwellTimeData[i][j].count > 0
      ) {
        result[i][j] = dwellTimeData[i][j].totalTime / dwellTimeData[i][j].count
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
  return matrix.reduce(
    (total, row) => total + row.reduce((rowTotal, cell) => rowTotal + cell, 0),
    0
  )
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

  return matrix.map(row => row.map(value => (value / total) * 100))
}
