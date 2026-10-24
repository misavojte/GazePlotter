import type { StimulusMedia } from '$lib/data/types'
import { readZipEntry, type ZipEntry } from '$lib/data/zip/blobZip'

/** Where a stimulus' reference media sits inside a `.gazeplotter` file: ONE
 *  place names these entries, for the save, the open and the re-bind. */
export function mediaEntryName(id: number, media: StimulusMedia): string {
  return `media/${id}.${mediaFileExtension(media)}`
}

/** From the upload name, falling back to the mime subtype. */
function mediaFileExtension(media: StimulusMedia): string {
  const dot = media.fileName.lastIndexOf('.')
  if (dot > 0 && dot < media.fileName.length - 1) {
    return media.fileName.slice(dot + 1).toLowerCase()
  }
  return media.mimeType.split('/')[1] ?? 'bin'
}

/** The media blobs an archive holds, by stimulus id. Entries are slices of
 *  the archive, so nothing is copied. A corrupt entry is left out: that
 *  stimulus loses its media rather than the file failing to open. */
export async function readMediaEntries(
  file: Blob,
  entries: Iterable<ZipEntry>,
  stimuliMedia: Record<number, StimulusMedia>
): Promise<Record<number, Blob>> {
  const found = [...entries]
  const blobs: Record<number, Blob> = {}
  for (const key of Object.keys(stimuliMedia)) {
    const id = Number(key)
    const prefix = `media/${id}.`
    const entry = found.find(candidate => candidate.name.startsWith(prefix))
    if (!entry) continue
    try {
      blobs[id] = await readZipEntry(file, entry, stimuliMedia[id].mimeType)
    } catch {
      // Corrupt entry: this stimulus simply loses its media.
    }
  }
  return blobs
}
