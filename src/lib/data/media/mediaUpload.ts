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

/** A stimulus name without a trailing media extension (`scene.jpg` ->
    `scene`); any other dot is kept, so `Trial 1.5` stays whole. */
function stripMediaExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return name
  return MEDIA_EXTENSIONS.has(name.slice(dot + 1).toLowerCase())
    ? name.slice(0, dot)
    : name
}

const nameKey = (name: string) => name.trim().toLowerCase()

/**
 * Match media files to stimuli by name, trimmed and case-insensitive, against
 * each stimulus's original or displayed name. Exporters often name a stimulus
 * after its file (`scene.jpg`), so a file matches on its full name first, then
 * with its extension stripped, against stimulus names taken both as-is and
 * with a media extension stripped (`scene.png` still finds `scene.jpg`).
 * Deliberately no fuzzy magic. Pass the VISIBLE stimuli only: a merged-away
 * member would take the file into a stimulus no plot shows.
 *
 * One medium per stimulus: the first file to claim a stimulus keeps it, and a
 * later file naming the same stimulus lands in `unmatched` with the files
 * that matched nothing, so the caller can hand both to the manual picker.
 */
export function matchMediaFilesToStimuli(
  files: File[],
  stimuli: readonly { id: number; originalName: string; displayedName: string }[]
): { matches: Map<number, File>; unmatched: File[] } {
  // Exact names win over extension-stripped ones, whatever the stimulus order.
  const exact = new Map<string, number>()
  const stripped = new Map<string, number>()
  for (const s of stimuli) {
    for (const name of [s.originalName, s.displayedName]) {
      if (!name) continue
      if (!exact.has(nameKey(name))) exact.set(nameKey(name), s.id)
      const bare = nameKey(stripMediaExtension(name))
      if (!stripped.has(bare)) stripped.set(bare, s.id)
    }
  }
  const lookup = (key: string) => exact.get(key) ?? stripped.get(key)

  const matches = new Map<number, File>()
  const unmatched: File[] = []
  for (const file of files) {
    // The file IS media, so whatever follows its last dot is its extension.
    const dot = file.name.lastIndexOf('.')
    const base = dot > 0 ? file.name.slice(0, dot) : file.name
    const id = lookup(nameKey(file.name)) ?? lookup(nameKey(base))
    if (id === undefined || matches.has(id)) unmatched.push(file)
    else matches.set(id, file)
  }
  return { matches, unmatched }
}
