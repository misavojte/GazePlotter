import type { WorkspaceFormatDefinition } from '../kernel/format'
import type { StimulusMedia } from '$lib/data/types'
import { readBlobZip, readZipEntry } from '$lib/data/zip/blobZip'

/**
 * A saved GazePlotter workspace archive (`.gazeplotter.zip`) — produced when
 * the workspace carries stimulus reference media. Contains the exact
 * `workspace.json` a plain export would produce plus one
 * `media/<stimulusId>.<ext>` entry per medium (see `buildWorkspace` in
 * `export/controller.ts`).
 *
 * Matched by the full `.gazeplotter.zip` suffix so plain `.zip` uploads keep
 * going to the archive formats (Pupil Cloud). A media entry that is missing
 * or unreadable drops only that stimulus's media (the ingest apply strips
 * blob-less metadata and warns) — never the whole workspace.
 */
export const workspaceZipFormat: WorkspaceFormatDefinition = {
  kind: 'workspace',
  id: 'workspace-zip',
  displayName: 'GazePlotter workspace archive',
  matchesFileName: name => name.toLowerCase().endsWith('.gazeplotter.zip'),

  async read(file) {
    const entries = await readBlobZip(file)
    const wsEntry = entries.get('workspace.json')
    if (!wsEntry) {
      throw new Error(
        'Not a GazePlotter workspace archive: workspace.json entry is missing'
      )
    }

    // Same lazy import as workspaceJson.ts: the migration chain pulls in the
    // metric library, which must stay out of the worker's startup chunk.
    const { processJsonFileWithGrid } = await import('../workspace/parser')
    const result = processJsonFileWithGrid(
      await (await readZipEntry(file, wsEntry)).text()
    )

    // Stored media entries come back as slices of the archive: no copy.
    const stimuliMedia = result.data.stimuliMedia as
      | Record<number, StimulusMedia>
      | undefined
    const mediaBlobs: Record<number, Blob> = {}
    if (stimuliMedia) {
      for (const key of Object.keys(stimuliMedia)) {
        const entry = [...entries.values()].find(e =>
          e.name.startsWith(`media/${key}.`)
        )
        if (!entry) continue
        try {
          mediaBlobs[Number(key)] = await readZipEntry(
            file,
            entry,
            stimuliMedia[Number(key)].mimeType
          )
        } catch {
          // Corrupt entry: this stimulus simply loses its media on apply.
        }
      }
    }

    return {
      kind: 'workspace',
      version: result.version,
      data: result.data,
      gridItems: result.gridItems,
      fileMetadata: result.fileMetadata,
      mediaBlobs,
    }
  },
}
