import type { StimulusMedia } from '../types'

/**
 * Shared upload-side helpers for stimulus reference media: the "Upload data"
 * pipeline (files claimed at partition, matched to stimuli by file name and
 * applied post-load — the event-file pattern) and the stimulus modal's manual
 * picker both build their `StimulusMedia` through here.
 */

const MEDIA_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'avif',
  'mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v', 'ogv',
])

/** Picker/drop affordances advertise these next to the data formats. */
export const MEDIA_FILE_ACCEPT = 'image/*,video/*'

export function mediaKindOf(file: File): StimulusMedia['kind'] | null {
  // Mime can be absent (drag-drop from some sources, test doubles).
  const mime = file.type ?? ''
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (!mime) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (MEDIA_EXTENSIONS.has(ext)) {
      return ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v', 'ogv'].includes(ext)
        ? 'video'
        : 'image'
    }
  }
  return null
}

/** Intrinsic pixel size — the gaze coordinate space. Main thread only. */
export async function readMediaDimensions(
  file: File,
  kind: StimulusMedia['kind']
): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file)
  try {
    if (kind === 'image') {
      const img = new Image()
      img.src = url
      await img.decode()
      return { width: img.naturalWidth, height: img.naturalHeight }
    }
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    const dims = await new Promise<{ width: number; height: number }>(
      (resolve, reject) => {
        video.addEventListener(
          'loadedmetadata',
          () => resolve({ width: video.videoWidth, height: video.videoHeight }),
          { once: true }
        )
        video.addEventListener(
          'error',
          () => reject(new Error('Video could not be decoded')),
          { once: true }
        )
        video.src = url
      }
    )
    video.src = ''
    return dims
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Build the metadata record for one upload; throws when undecodable. */
export async function buildStimulusMediaFromFile(
  file: File
): Promise<StimulusMedia> {
  const kind = mediaKindOf(file)
  if (!kind) throw new Error('Not an image or video file')
  const { width, height } = await readMediaDimensions(file, kind)
  if (!(width > 0) || !(height > 0)) {
    throw new Error('The file has no readable pixel dimensions')
  }
  return {
    kind,
    mimeType: file.type || (kind === 'video' ? 'video/mp4' : 'image/png'),
    fileName: file.name,
    naturalWidth: width,
    naturalHeight: height,
  }
}

/** The gaze-coordinate rectangle a medium covers (see StimulusMedia.region). */
export function mediaRegionOf(media: StimulusMedia): {
  x: number
  y: number
  width: number
  height: number
} {
  return (
    media.region ?? {
      x: 0,
      y: 0,
      width: media.naturalWidth,
      height: media.naturalHeight,
    }
  )
}

/**
 * Match media files to stimuli by name: the file's base name (extension
 * stripped) against each stimulus's original or displayed name, trimmed and
 * case-insensitive. Deliberately no fuzzy magic — an unmatched file surfaces
 * in `unmatched` so the caller can point the user at the manual picker.
 * Later files win when two target the same stimulus (one medium each).
 */
export function matchMediaFilesToStimuli(
  files: File[],
  stimuliRows: readonly (readonly string[])[]
): { matches: Map<number, File>; unmatched: File[] } {
  const byName = new Map<string, number>()
  for (let id = 0; id < stimuliRows.length; id++) {
    const row = stimuliRows[id]
    if (!row) continue
    for (const name of [row[0], row[1]]) {
      if (name) byName.set(name.trim().toLowerCase(), id)
    }
  }

  const matches = new Map<number, File>()
  const unmatched: File[] = []
  for (const file of files) {
    const dot = file.name.lastIndexOf('.')
    const base = (dot > 0 ? file.name.slice(0, dot) : file.name)
      .trim()
      .toLowerCase()
    const id = byName.get(base)
    if (id === undefined) unmatched.push(file)
    else matches.set(id, file)
  }
  return { matches, unmatched }
}
