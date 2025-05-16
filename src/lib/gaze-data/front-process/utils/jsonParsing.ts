import type {
  DataType,
  JsonImportOldFormat,
  JsonImportNewFormat,
} from '$lib/gaze-data/shared/types'
import type { AllGridTypes } from '$lib/workspace/type/gridType'

/**
 * Type guard to check if the data is in the new format
 */
function isNewFormat(data: unknown): data is JsonImportNewFormat {
  return (
    typeof data === 'object' &&
    data !== null &&
    'version' in data &&
    data.version === 2 &&
    'data' in data &&
    'gridItems' in data
  )
}

/**
 * Type guard to check if the data is in the old format
 */
function isOldFormat(data: unknown): data is JsonImportOldFormat {
  return (
    typeof data === 'object' &&
    data !== null &&
    'stimuli' in data &&
    'participants' in data
  )
}

/**
 * Validates the basic structure of the data
 * @throws Error if the data structure is invalid
 */
function validateBasicStructure(data: DataType): void {
  if (!data.stimuli?.data || !Array.isArray(data.stimuli.data)) {
    throw new Error('Invalid data structure: missing or invalid stimuli data')
  }
  if (!data.participants?.data || !Array.isArray(data.participants.data)) {
    throw new Error(
      'Invalid data structure: missing or invalid participants data'
    )
  }
}

/**
 * Normalizes the data structure to ensure all required fields exist
 * and the segments array is properly initialized for all stimuli and participants.
 *
 * This prevents errors when processing data where some participants
 * don't have data for all stimuli.
 *
 * @param data - The DataType object parsed from JSON
 * @returns The normalized DataType with complete structure
 */
export function normalizeDataStructure(data: DataType): DataType {
  // Create segments array if it doesn't exist
  if (!data.segments) {
    data.segments = []
  }

  // Get counts of stimuli and participants
  const stimuliCount = data.stimuli.data.length
  const participantsCount = data.participants.data.length

  // Ensure segments array has an entry for each stimulus
  while (data.segments.length < stimuliCount) {
    data.segments.push([])
  }

  // For each stimulus, ensure we have initialized participant arrays
  for (let stimulusIndex = 0; stimulusIndex < stimuliCount; stimulusIndex++) {
    const stimulusSegments = data.segments[stimulusIndex] || []
    data.segments[stimulusIndex] = stimulusSegments

    // Ensure each stimulus has entries for all participants (even if empty)
    while (stimulusSegments.length < participantsCount) {
      stimulusSegments.push([])
    }
  }

  return data
}

/**
 * Validates segment data to ensure consistency and prevent errors during rendering.
 * This addresses issues where segment IDs don't exist or segments are accessed incorrectly.
 *
 * @param data - The normalized DataType object
 * @returns The validated DataType with consistent segments
 */
export function validateSegments(data: DataType): DataType {
  // Process all stimuli
  for (
    let stimulusIndex = 0;
    stimulusIndex < data.segments.length;
    stimulusIndex++
  ) {
    const stimulusSegments = data.segments[stimulusIndex]

    // Process all participants for this stimulus
    for (
      let participantIndex = 0;
      participantIndex < stimulusSegments.length;
      participantIndex++
    ) {
      let segments = stimulusSegments[participantIndex]

      // If segments is null or undefined, initialize it as an empty array
      if (!segments) {
        segments = []
        stimulusSegments[participantIndex] = segments
        continue
      }

      // Filter out any invalid segments (must have at least 3 elements: start, end, category)
      segments = segments.filter(
        segment =>
          Array.isArray(segment) &&
          segment.length >= 3 &&
          typeof segment[0] === 'number' &&
          typeof segment[1] === 'number' &&
          typeof segment[2] === 'number'
      )

      // Sort segments by start time (important for ScarfPlot rendering)
      segments.sort((a, b) => a[0] - b[0])

      // Update the filtered and sorted segments
      stimulusSegments[participantIndex] = segments
    }
  }

  return data
}

/**
 * Processes a JSON file and returns the parsed and validated data.
 * Handles both old and new format JSON files.
 *
 * @param fileContent - The content of the JSON file as a string
 * @returns The processed DataType object
 * @throws Error if parsing or processing fails
 */
export function processJsonFile(fileContent: string): DataType {
  // Parse the JSON file content
  const parsed = JSON.parse(fileContent)

  // Determine the format and extract the data
  let data: DataType
  if (isNewFormat(parsed)) {
    data = parsed.data
  } else if (isOldFormat(parsed)) {
    data = parsed
  } else {
    throw new Error(
      'Invalid JSON format: file must be either old or new format'
    )
  }

  // Validate basic structure
  validateBasicStructure(data)

  // Normalize the data structure to handle missing participants in stimuli
  data = normalizeDataStructure(data)

  // Validate segments and ensure consistency
  data = validateSegments(data)

  return data
}

/**
 * Type for the result of processing a JSON file
 */
export type JsonProcessingResult = {
  data: DataType
  gridItems?: AllGridTypes[]
}

/**
 * Processes a JSON file and returns both the data and grid items if available.
 *
 * @param fileContent - The content of the JSON file as a string
 * @returns Object containing the processed data and optional grid items
 * @throws Error if parsing or processing fails
 */
export function processJsonFileWithGrid(
  fileContent: string
): JsonProcessingResult {
  // Parse the JSON file content
  const parsed = JSON.parse(fileContent)

  // Determine the format and extract the data
  if (isNewFormat(parsed)) {
    const data = processJsonFile(JSON.stringify(parsed.data))
    return {
      data,
      gridItems: parsed.gridItems,
    }
  } else if (isOldFormat(parsed)) {
    return {
      data: processJsonFile(fileContent),
    }
  } else {
    throw new Error(
      'Invalid JSON format: file must be either old or new format'
    )
  }
}
