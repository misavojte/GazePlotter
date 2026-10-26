import type { StimulusMedia } from '$lib/data/types'
import { mediaKindOf } from '$lib/data/media/stimulusMedia'

/**
 * Decoding uploaded reference media in the browser: the "Upload data" path
 * and the stimulus modal's picker both build their `StimulusMedia` here.
 * Matching files to stimuli is data (`data/media/stimulusMedia`).
 */

/** Picker/drop affordances advertise these next to the data formats. */
export const MEDIA_FILE_ACCEPT = 'image/*,video/*'

/** Intrinsic pixel size, the gaze coordinate space. Main thread only. */
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
    // Wait for a decoded frame, not just metadata: a codec the browser can't
    // play (e.g. HEVC .mov) has readable headers but fails here.
    video.preload = 'auto'
    video.muted = true
    const dims = await new Promise<{ width: number; height: number }>(
      (resolve, reject) => {
        video.addEventListener(
          'loadeddata',
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
