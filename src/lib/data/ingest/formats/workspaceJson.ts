import type { WorkspaceFormatDefinition } from '../kernel/format'
import { processJsonFileWithGrid } from '../workspace/parser'

/**
 * A saved GazePlotter workspace (.json) — dataset, grid layout, and the
 * original file metadata in one self-describing file. Runs the migration
 * chain (legacy versions → current schema), so old exports keep loading.
 *
 * Claimed by file name, and only when it is the FIRST file of an upload
 * (see the workspace-precedence rule in `kernel/job.ts`).
 */
export const workspaceJsonFormat: WorkspaceFormatDefinition = {
  kind: 'workspace',
  id: 'workspace-json',
  displayName: 'GazePlotter workspace',
  matchesFileName: name => name.toLowerCase().endsWith('.json'),

  async read(bytes) {
    const text = new TextDecoder('utf-8').decode(bytes)
    const result = processJsonFileWithGrid(text)
    return {
      kind: 'workspace',
      version: result.version,
      data: result.data,
      gridItems: result.gridItems,
      fileMetadata: result.fileMetadata,
    }
  },
}
