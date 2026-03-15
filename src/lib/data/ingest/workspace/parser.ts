import type { DataType, JsonImportNewFormat } from '$lib/data/types'
import type { GridItemSnapshot } from '$lib/workspace'
import { DEFAULT_GRID_STATE_DATA } from '$lib/workspace/grid/const'
import { runMigrations } from './migrations'
import { processAndValidateData, validateBasicStructure } from './validator'

/**
 * Processes a JSON file and returns the parsed and validated data.
 * Uses the migration pipeline to normalize legacy files.
 *
 * @param fileContent - The content of the JSON file as a string
 * @returns The processed DataType object
 * @throws Error if parsing or processing fails
 */
export function processJsonFile(fileContent: string) {
  const rawParsed = JSON.parse(fileContent)
  const modernData = runMigrations(rawParsed)

  validateBasicStructure(modernData.data)

  return processAndValidateData(modernData.data)
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
  const rawParsed = JSON.parse(fileContent)

  // 1. Pure data transformation isolates legacy support from modern logic
  const modernData = runMigrations(rawParsed)

  // 2. Validate the guaranteed modern structure
  validateBasicStructure(modernData.data)

  return {
    ...modernData,
    data: processAndValidateData(modernData.data),
    gridItems: modernData.gridItems ?? DEFAULT_GRID_STATE_DATA,
  }
}
