/**
 * The stimulus under a gaze plot (Fixation Heatmap, Scanpath): how its image
 * or video frame is drawn, and the pane field choosing that. Its gaze-space
 * frame is `stimulusSpace.ts`.
 */
import { commonIs, type SectionField } from '$lib/plots/definePlot'
import type { StimulusMedia } from '$lib/data/types'
import { strokeCrispRect } from './canvasUtils'
import { GRIDLINE_PRIMARY } from './const'

export type StimulusBackground = 'image' | 'grayscale' | 'dimmed' | 'none'

const PAPER = '#ffffff'
/** Grey whose zero saturation, composited with 'saturation', desaturates the image. */
const DESATURATE = '#808080'
const DIM_ALPHA = 0.5

/**
 * The stimulus at its projected rect (`x, y, w, h` in canvas px): the image or
 * video frame in the chosen mode, else white inside the stimulus outline.
 */
export function drawStimulusBackground(
  ctx: CanvasRenderingContext2D,
  element: CanvasImageSource | null,
  x: number,
  y: number,
  w: number,
  h: number,
  mode: StimulusBackground
): void {
  if (!element || mode === 'none') {
    ctx.fillStyle = PAPER
    ctx.fillRect(x, y, w, h)
    strokeCrispRect(ctx, x, y, w, h, GRIDLINE_PRIMARY.COLOR, 1)
    return
  }
  const desaturated = mode === 'grayscale' || mode === 'dimmed'
  ctx.save()
  // Opaque underlay: 'saturation' would turn transparent pixels grey.
  if (desaturated) {
    ctx.fillStyle = PAPER
    ctx.fillRect(x, y, w, h)
  }
  ctx.drawImage(element, x, y, w, h)
  if (desaturated) {
    // Zero saturation keeps the image's luminosity: grayscale without a filter or a copy.
    ctx.beginPath()
    ctx.rect(x, y, w, h)
    ctx.clip()
    ctx.globalCompositeOperation = 'saturation'
    ctx.fillStyle = DESATURATE
    ctx.fillRect(x, y, w, h)
    if (mode === 'dimmed') {
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = DIM_ALPHA
      ctx.fillStyle = PAPER
      ctx.fillRect(x, y, w, h)
    }
  }
  ctx.restore()
}

/** How far (ms) a parked video's frame may sit from the drawn moment: a frame at 20 fps. */
const FRAME_TOLERANCE_MS = 50

/**
 * A video is drawn only under the moment shown, never under everything. On a
 * clock the clock seeks the element there; without one (export) only when the
 * shared element already shows that frame (`frameAt`, recording ms), as another
 * clock or a running playback may have moved it. Otherwise white.
 */
export function mediaBackground(
  mode: StimulusBackground,
  s: { isVideo: boolean; playTime: number | null; onClock: boolean; frameAt: number | null }
): StimulusBackground {
  if (!s.isVideo) return mode
  if (s.playTime === null) return 'none'
  if (s.onClock) return mode
  return s.frameAt !== null && Math.abs(s.frameAt - s.playTime) <= FRAME_TOLERANCE_MS ? mode : 'none'
}

/** The Background pane field, shown while every edited plot's stimulus has a medium of `kinds`. */
export function stimulusBackgroundField(kinds: readonly StimulusMedia['kind'][]): SectionField {
  return {
    kind: 'enum',
    key: 'background',
    label: 'Background',
    options: [
      { label: 'Full color', value: 'image', detail: 'The stimulus as shown to participants' },
      { label: 'Grayscale', value: 'grayscale', detail: 'Without color, so the plot colors stand out' },
      { label: 'Dimmed grayscale', value: 'dimmed', detail: 'Grayscale faded toward white' },
      { label: 'None', value: 'none', detail: 'White, within the stimulus outline' },
    ],
    // Every edited plot must show a medium, or the control would be dead on some.
    showWhen: commonIs((s, ctx) => {
      const kind = ctx.engine.metadata?.stimuliMedia?.[s.stimulusId ?? 0]?.kind
      return kind !== undefined && kinds.includes(kind)
    }, true),
  }
}
