import type { Rect } from '$lib/data/media/mediaAlignment'
import type { StimulusMedia } from '$lib/data/types'
import { PLOT_BORDER_PX } from './const'
import { useMediaElements } from './mediaElements.svelte'
import { drawStimulusBackground, stimulusSpace, worldAspect, type StimulusBackground } from './stimulusBackground'
import type { FrameAxes, FrameGutters, PlotFrame } from './usePlot.svelte'

/**
 * A stimulus-space figure's frame (scanpath, fixation heatmap): the decoded
 * media, the equal-aspect fit of `world` (gaze px) with its ticks, and the
 * projection to canvas px. `frame` is only read in an effect, so it may close
 * over the `usePlot` handle created after this.
 */
export function useStimulusSpace(opts: {
  world: () => Rect | null
  tickCount: number
  media: () => StimulusMedia | null
  mediaStimulusId: () => number | undefined
  frame: () => PlotFrame
}) {
  const mediaElements = useMediaElements()
  /** Null while it decodes; reads the cache version so the canvas repaints when it is ready. */
  const mediaElement = $derived.by(() => {
    const media = opts.media()
    const id = opts.mediaStimulusId()
    if (!media || id === undefined) return null
    void mediaElements.version
    return mediaElements.getReadyElement(id, media)
  })
  /** The browser can't decode the medium (an unsupported video codec). */
  const mediaFailed = $derived.by(() => {
    const id = opts.mediaStimulusId()
    if (!opts.media() || id === undefined) return false
    void mediaElements.version
    return mediaElements.failed(id)
  })

  let frameW = $state(0)
  let frameH = $state(0)
  $effect(() => {
    const f = opts.frame()
    frameW = f.width
    frameH = f.height
  })
  const space = $derived.by(() => {
    const world = opts.world()
    return world ? stimulusSpace(world, frameW, frameH, opts.tickCount) : null
  })

  // Eye-tracker y already grows downward, as does canvas y: no flip.
  const x = (wx: number, frame: PlotFrame) => frame.x + wx * space!.view.scale + space!.view.offsetX
  const y = (wy: number, frame: PlotFrame) => frame.y + wy * space!.view.scale + space!.view.offsetY

  return {
    get mediaElement() { return mediaElement },
    get mediaFailed() { return mediaFailed },
    get space() { return space },
    x,
    y,
    /** The data rect takes the world's shape, so the axes span exactly the image (or extent). */
    gutters: (): FrameGutters => {
      const world = opts.world()
      return world ? { pad: { right: PLOT_BORDER_PX }, aspect: worldAspect(world) } : {}
    },
    axes: (): FrameAxes =>
      space
        ? { bottom: { ticks: space.xTicks, title: 'X' }, left: { ticks: space.yTicks, title: 'Y' } }
        : {},
    /** The media at `rect` (gaze px) in the chosen mode, else white inside its outline. */
    drawMedia: (ctx: CanvasRenderingContext2D, frame: PlotFrame, rect: Rect, mode: StimulusBackground) => {
      const s = space!.view.scale
      drawStimulusBackground(ctx, mediaElement, x(rect.x, frame), y(rect.y, frame), rect.width * s, rect.height * s, mode)
    },
  }
}
