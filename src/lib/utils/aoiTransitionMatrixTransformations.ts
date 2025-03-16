/**
 * AOI Transition Matrix Data Transformation Utility
 *
 * This module provides functions for transforming gaze data into AOI transition matrices.
 * It analyzes fixation sequences to determine how participants transition between different Areas of Interest.
 */

import { getAois, getNumberOfSegments, getSegment } from '$lib/stores/dataStore'
import type { ExtendedInterpretedDataType } from '$lib/type/Data/InterpretedData/ExtendedInterpretedDataType'

// Identifier for fixations outside any defined AOI
const OUTSIDE_AOI_ID = -1
const OUTSIDE_AOI_NAME = 'Outside AOI'

// Cell sizing constants - adjusted for SVG implementation
const BASE_CELL_SIZE = 50 // Base size of each matrix cell in pixels (reduced)
const CELL_SIZE_ADJUSTMENT = 6 // Size reduction per AOI above baseline
const MIN_CELL_SIZE = 30 // Minimum cell size (reduced)
const MAX_CELL_SIZE = 60 // Maximum cell size (reduced)
const GRID_CELL_HEIGHT = 40 // Height of one grid cell in the workspace
const GRID_CELL_WIDTH = 40 // Width of one grid cell in the workspace
const BASE_NUM_AOIS = 5 // Baseline number of AOIs for sizing
const MIN_GRID_WIDTH = 8 // Minimum width in grid cells (reduced from 10)
const MIN_GRID_HEIGHT = 8 // Minimum height in grid cells (reduced from 10)
const HEADER_HEIGHT = 40 // Estimated header height in pixels
const LEGEND_HEIGHT = 40 // Fixed legend height (reduced)
const SVG_CORNER_SIZE = 40 // Size of the corner cell in SVG

// Type for fixation data
interface FixationData {
  segmentId: number
  start: number
  end: number
  duration: number
  aoiId: number
}

/**
 * Extracts fixations from gaze data segments for a specific participant and stimulus
 *
 * @param stimulusId ID of the stimulus
 * @param participantId ID of the participant
 * @returns Array of fixation segments with their AOI information
 */
function extractFixations(
  stimulusId: number,
  participantId: number
): FixationData[] {
  const numberOfSegments = getNumberOfSegments(stimulusId, participantId)
  const fixations: FixationData[] = []

  for (let segmentId = 0; segmentId < numberOfSegments; segmentId++) {
    const segment = getSegment(stimulusId, participantId, segmentId)

    // We only care about fixations (category.id === 0)
    if (segment.category.id === 0) {
      // Get the AOI ID (use OUTSIDE_AOI_ID if no AOI)
      let aoiId = OUTSIDE_AOI_ID

      // If segment has AOI data, use the first one
      // Note: In some cases, a fixation might be in multiple AOIs
      // For transition matrix purposes, we'll use the first AOI
      if (segment.aoi && segment.aoi.length > 0) {
        aoiId = segment.aoi[0].id
      }

      fixations.push({
        segmentId,
        start: segment.start,
        end: segment.end,
        duration: segment.end - segment.start,
        aoiId,
      })
    }
  }

  return fixations
}

/**
 * Builds a transition matrix for a single participant
 *
 * @param fixations Array of fixation objects with AOI information
 * @param aoiIds Array of AOI IDs including OUTSIDE_AOI_ID
 * @returns Matrix of transition counts for this participant
 */
function buildParticipantTransitionMatrix(
  fixations: FixationData[],
  aoiIds: number[]
): number[][] {
  // Create a matrix filled with zeros
  const matrix: number[][] = Array(aoiIds.length)
    .fill(0)
    .map(() => Array(aoiIds.length).fill(0))

  // Process transitions between consecutive fixations
  for (let i = 0; i < fixations.length - 1; i++) {
    const fromAoiId = fixations[i].aoiId
    const toAoiId = fixations[i + 1].aoiId

    // Get indices in our aoiIds array
    const fromIdx = aoiIds.findIndex(id => id === fromAoiId)
    const toIdx = aoiIds.findIndex(id => id === toAoiId)

    // Only count if both AOIs are in our list (they should be)
    if (fromIdx !== -1 && toIdx !== -1) {
      matrix[fromIdx][toIdx] += 1
    }
  }

  return matrix
}

/**
 * Combines multiple participant matrices into a single matrix
 *
 * @param matrices Array of participant transition matrices
 * @returns Combined transition matrix
 */
function combineTransitionMatrices(matrices: number[][][]) {
  if (matrices.length === 0) return []

  const size = matrices[0].length
  const result: number[][] = Array(size)
    .fill(0)
    .map(() => Array(size).fill(0))

  for (const matrix of matrices) {
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        result[i][j] += matrix[i][j]
      }
    }
  }

  return result
}

/**
 * Finds the maximum value in a matrix
 *
 * @param matrix 2D array of numbers
 * @returns Maximum value found in the matrix
 */
function findMaxValue(matrix: number[][]) {
  let max = 0
  for (const row of matrix) {
    for (const value of row) {
      if (value > max) max = value
    }
  }
  return max
}

/**
 * Calculates the optimal cell size based on AOI count
 *
 * @param aoiCount Number of AOIs
 * @returns The calculated cell size in pixels
 */
function calculateCellSize(aoiCount: number): number {
  // Reduce cell size as the number of AOIs increases
  const sizeReduction =
    Math.max(0, aoiCount - BASE_NUM_AOIS) * CELL_SIZE_ADJUSTMENT
  return Math.max(
    MIN_CELL_SIZE,
    Math.min(MAX_CELL_SIZE, BASE_CELL_SIZE - sizeReduction)
  )
}

/**
 * Calculates the grid width required for the transition matrix
 *
 * @param stimulusId ID of the stimulus
 * @returns The recommended width in grid cells
 */
export function getTransitionMatrixWidth(stimulusId: number): number {
  const aois = getAois(stimulusId)
  const aoiCount = aois.length + 1 // +1 for "Outside AOI"

  // Calculate cell size based on AOI count
  const cellSize = calculateCellSize(aoiCount)

  // Calculate total matrix width for SVG
  const matrixWidth = SVG_CORNER_SIZE + cellSize * aoiCount

  // Convert to grid cells with a tighter fit
  return Math.max(MIN_GRID_WIDTH, Math.ceil(matrixWidth / GRID_CELL_WIDTH))
}

/**
 * Calculates the grid height required for the transition matrix
 *
 * @param stimulusId ID of the stimulus
 * @returns The recommended height in grid cells
 */
export function getTransitionMatrixHeight(stimulusId: number): number {
  const aois = getAois(stimulusId)
  const aoiCount = aois.length + 1 // +1 for "Outside AOI"

  // Calculate cell size based on AOI count
  const cellSize = calculateCellSize(aoiCount)

  // Calculate total SVG height with fixed legend height
  const matrixHeight = SVG_CORNER_SIZE + cellSize * aoiCount + LEGEND_HEIGHT

  // Convert to grid cells with a tighter fit
  return Math.max(
    MIN_GRID_HEIGHT,
    Math.ceil((matrixHeight + HEADER_HEIGHT) / GRID_CELL_HEIGHT)
  )
}

/**
 * Calculates the AOI transition matrix for a given stimulus and participants
 *
 * @param stimulusId ID of the stimulus to analyze
 * @param participantIds Array of participant IDs to include in the analysis
 * @returns Object containing the transition matrix and related data
 */
export function calculateTransitionMatrix(
  stimulusId: number,
  participantIds: number[]
) {
  // Get all AOIs for the stimulus
  const aois: ExtendedInterpretedDataType[] = getAois(stimulusId)

  // Create a map of AOI IDs to their names and colors
  const aoiMap = new Map<number, { name: string; color: string }>()

  // Add all AOIs to the map
  for (const aoi of aois) {
    aoiMap.set(aoi.id, {
      name: aoi.displayedName,
      color: aoi.color,
    })
  }

  // Add "Outside AOI" as a special case
  aoiMap.set(OUTSIDE_AOI_ID, {
    name: OUTSIDE_AOI_NAME,
    color: '#a6a6a6', // Gray color for outside AOI
  })

  // Create array of AOI IDs (sorted so Outside AOI is last)
  const aoiIds = [...aoiMap.keys()].sort((a, b) => {
    if (a === OUTSIDE_AOI_ID) return 1
    if (b === OUTSIDE_AOI_ID) return -1
    return a - b
  })

  // Create arrays for names and colors in matching order
  const aoiNames = aoiIds.map(id => aoiMap.get(id)?.name || 'Unknown')
  const aoiColors = aoiIds.map(id => aoiMap.get(id)?.color || '#cccccc')

  // Process each participant's data
  const participantMatrices: number[][][] = []

  for (const participantId of participantIds) {
    // Check if this participant exists and has data for this stimulus
    const fixations = extractFixations(stimulusId, participantId)

    // Only process if we have at least two fixations (needed for a transition)
    if (fixations.length >= 2) {
      const matrix = buildParticipantTransitionMatrix(fixations, aoiIds)
      participantMatrices.push(matrix)
    }
  }

  // Combine all participant matrices
  const matrix =
    participantMatrices.length > 0
      ? combineTransitionMatrices(participantMatrices)
      : Array(aoiIds.length)
          .fill(0)
          .map(() => Array(aoiIds.length).fill(0))

  // Find the maximum transition value for color scaling
  const maxValue = findMaxValue(matrix)

  return {
    aoiNames,
    matrix,
    maxValue,
    aoiColors,
  }
}
