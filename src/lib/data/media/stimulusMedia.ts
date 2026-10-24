import type { StimulusMedia } from '../types'

/**
 * Reference media as data: what counts as media, the gaze rectangle a medium
 * covers, and how uploaded files match stimuli by name. Decoding the files is
 * the host's job (`session/mediaUpload`).
 */

const MEDIA_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'avif',
  'mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v', 'ogv',
])
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v', 'ogv'])

export function mediaKindOf(file: File): StimulusMedia['kind'] | null {
  // Mime can be absent (drag-drop from some sources, test doubles).
  const mime = file.type ?? ''
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (!mime) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (MEDIA_EXTENSIONS.has(ext)) return VIDEO_EXTENSIONS.has(ext) ? 'video' : 'image'
  }
  return null
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
