/**
 * The stimulus under a gaze plot (Fixation Heatmap, Scanpath): its gaze-space
 * view, how its image or video frame is drawn, and the pane field choosing that.
 */
import { commonIs, type SectionField } from '$lib/plots/definePlot'
import { fitView, type Rect, type View } from '$lib/data/media/mediaAlignment'
import type { StimulusMedia } from '$lib/data/types'
import { strokeCrispRect } from './canvasUtils'
import { GRIDLINE_PRIMARY } from './const'
import { linearTicks } from './ticks'

export type StimulusBackground = 'image' | 'grayscale' | 'dimmed' | 'none'

const PAPER = '#ffffff'
/** Grey whose zero saturation, composited with 'saturation', desaturates the image. */
const DESATURATE = '#808080'
const DIM_ALPHA = 0.5

/** Data rect width/height for `world`, held within 1:3..3:1 so a thin extent stays a usable plot. */
export function worldAspect(world: Rect): number {
  const a = world.height > 0 ? world.width / world.height : 1
  return Math.min(3, Math.max(1 / 3, a))
}

/** Equal-aspect view of `world` in a frame-relative box, with ticks over the gaze range it shows. */
export function stimulusSpace(
  world: Rect,
  frameW: number,
  frameH: number,
  tickCount: number
): { view: View; xTicks: ReturnType<typeof linearTicks>; yTicks: ReturnType<typeof linearTicks> } {
  const w = Math.max(1, frameW)
  const h = Math.max(1, frameH)
  const view = fitView(world, w, h, { top: 0, right: 0, bottom: 0, left: 0 })
  const minX = -view.offsetX / view.scale
  const minY = -view.offsetY / view.scale
  return {
    view,
    xTicks: linearTicks(minX, minX + w / view.scale, tickCount),
    yTicks: linearTicks(minY, minY + h / view.scale, tickCount),
  }
}

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
