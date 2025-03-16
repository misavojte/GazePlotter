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
  AVERAGE = 'average',
  MEDIAN = 'median',
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
    case AggregationMethod.AVERAGE:
      resultMatrix = calculateAverageMatrix(participantMatrices)
      // console.log('Using AVERAGE aggregation method')
      break
    case AggregationMethod.MEDIAN:
      resultMatrix = calculateMedianMatrix(participantMatrices)
      // console.log('Using MEDIAN aggregation method')
      break
    case AggregationMethod.SUM:
    default:
      resultMatrix = calculateSumMatrix(participantMatrices)
      // console.log('Using SUM aggregation method')
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
 * Calculates the average (mean) of all participant matrices
 *
 * @param matrices Array of participant matrices
 * @returns A new matrix with average values
 */
function calculateAverageMatrix(matrices: number[][][]): number[][] {
  if (matrices.length === 0) return []

  const rows = matrices[0].length
  const cols = matrices[0][0].length
  const activeParticipantCount =
    matrices.filter(matrix => matrix.some(row => row.some(cell => cell > 0)))
      .length || 1 // Use 1 as divisor if no active participants

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

  // Divide by number of active participants
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[i][j] = result[i][j] / activeParticipantCount
    }
  }

  return result
}

/**
 * Calculates the median of all participant matrices
 *
 * @param matrices Array of participant matrices
 * @returns A new matrix with median values
 */
function calculateMedianMatrix(matrices: number[][][]): number[][] {
  if (matrices.length === 0) return []

  const rows = matrices[0].length
  const cols = matrices[0][0].length

  // Initialize result matrix
  const result = Array(rows)
    .fill(0)
    .map(() => Array(cols).fill(0))

  // Calculate median for each cell position
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      // Get all values at this position
      const values = matrices.map(matrix => matrix[i][j]).sort((a, b) => a - b)

      // Calculate median
      const mid = Math.floor(values.length / 2)
      result[i][j] =
        values.length % 2 === 0
          ? (values[mid - 1] + values[mid]) / 2
          : values[mid]
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
