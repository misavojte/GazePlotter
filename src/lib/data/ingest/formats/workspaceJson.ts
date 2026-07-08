import type { WorkspaceFormatDefinition } from '../kernel/format'

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
    // Lazy on purpose: the migration chain materializes metric instances
    // through the metric registry — the whole metric library. Loading it here,
    // only when a workspace file is actually opened, keeps that library out of
    // the stream-parsing worker's startup chunk (fresh parses never need it;
    // their starter seeding happens on the main thread, see
    // IngestService.handleDone).
    const { processJsonFileWithGrid } = await import('../workspace/parser')
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
