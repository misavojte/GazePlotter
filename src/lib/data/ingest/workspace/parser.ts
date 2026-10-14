import type { JsonImportNewFormat } from '$lib/data/types'
import type { FileMetadataType } from '../types'
import type { GridItemSnapshot } from '$lib/workspace/grid/types'
import { runMigrations } from './migrations'
import { processAndValidateData, validateBasicStructure } from './validator'
import { isStoredSegments } from '$lib/data/binary/storedSegments'



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
  return processWorkspaceObject(JSON.parse(fileContent))
}

/** {@link processJsonFileWithGrid} for an already-parsed workspace (the
 *  `.gazeplotter` reader reattaches stored segments first). */
export function processWorkspaceObject(rawParsed: unknown): JsonImportNewFormat {
  if (isStoredSegments((rawParsed as any)?.data?.segments)) {
    throw new Error('This workspace keeps its data in a .gazeplotter file. Open that file instead.')
  }

  // 1. Pure data transformation isolates legacy support from modern logic
  const modernData = runMigrations(rawParsed)

  // 2. Validate the guaranteed modern structure
  validateBasicStructure(modernData.data)

  return {
    version: modernData.version as JsonImportNewFormat['version'],
    data: processAndValidateData(modernData.data),
    // Absent gridItems stay absent: the ingest apply resolves the session's
    // default layout, so the fallback has exactly one owner.
    gridItems: modernData.gridItems as GridItemSnapshot[] | undefined,
    fileMetadata: modernData.fileMetadata as FileMetadataType | null | undefined,
  }
}
