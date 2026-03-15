import type {
  DataType,
  JsonImportOldFormat,
  JsonImportNewFormat,
} from '$lib/data/types'
import { jsonSegmentsToBinary, DEFAULT_NO_AOI_TREATMENT } from '$lib/data/types'
import { DEFAULT_GRID_STATE_DATA } from '$lib/workspace'
import type { GridItemSnapshot } from '$lib/workspace'

/**
 * Type guard to check if the data is in the new format
 */
function isNewFormat(data: unknown): data is JsonImportNewFormat {
  return (
    typeof data === 'object' &&
    data !== null &&
    'version' in data &&
    (data.version === 2 || data.version === 3) &&
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
 * Normalizes and validates the data structure.
 * Ensures required fields exist and segments are properly formatted and sorted.
 */
export function processAndValidateData(
  data: Omit<DataType, 'segments'> & { segments?: any }
): DataType {
  const stimuliCount = data.stimuli.data.length

  // 1. Normalize basic metadata
  data.noAoiTreatment ??= { ...DEFAULT_NO_AOI_TREATMENT }
  data.aois.hiddenAois ??= []

  // Fill hiddenAois up to stimuliCount
  for (let s = data.aois.hiddenAois.length; s < stimuliCount; s++) {
    data.aois.hiddenAois.push([])
  }

  // 2. Validate and sort segments if they are in array format
  if (Array.isArray(data.segments)) {
    const rawSegments = data.segments as number[][][][]

    for (let s = 0; s < rawSegments.length; s++) {
      const stimSegments = rawSegments[s] || []
      rawSegments[s] = stimSegments

      for (let p = 0; p < stimSegments.length; p++) {
        const pSegments = stimSegments[p]
        if (!pSegments) {
          stimSegments[p] = []
          continue
        }

        // Inline validation and filtering to avoid extra passes
        const valid = []
        for (let i = 0; i < pSegments.length; i++) {
          const seg = pSegments[i]
          if (
            Array.isArray(seg) &&
            seg.length >= 3 &&
            typeof seg[0] === 'number' &&
            typeof seg[1] === 'number' &&
            typeof seg[2] === 'number'
          ) {
            valid.push(seg)
          }
        }

        // Sort in-place by start time
        valid.sort((a, b) => a[0] - b[0])
        stimSegments[p] = valid
      }
    }

    data.segments = jsonSegmentsToBinary(rawSegments)
  }

  return data as DataType
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
  if (isNewFormat(parsed)) {
    validateBasicStructure(parsed.data)
    return processAndValidateData(parsed.data)
  } else if (isOldFormat(parsed)) {
    const data = parsed as unknown as DataType & { segments: number[][][][] }
    validateBasicStructure(data)
    return processAndValidateData(data)
  } else {
    throw new Error(
      'Invalid JSON format: file must be GazePlotter JSON format (legacy or version 2 or 3)'
    )
  }
}

/**
 * Type for the result of processing a JSON file
 */
export type JsonProcessingResult = {
  data: DataType
  gridItems?: GridItemSnapshot[]
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
): JsonImportNewFormat {
  // Parse the JSON file content
  const parsed = JSON.parse(fileContent)

  // Determine the format and extract the data
  if (isNewFormat(parsed)) {
    validateBasicStructure(parsed.data)
    return {
      ...parsed,
      data: processAndValidateData(parsed.data),
    }
  } else if (isOldFormat(parsed)) {
    return {
      version: 2,
      data: processJsonFile(fileContent),
      gridItems: DEFAULT_GRID_STATE_DATA,
    }
  } else {
    throw new Error(
      'Invalid JSON format: file must be GazePlotter JSON format (legacy or version 2 or 3)'
    )
  }
}
