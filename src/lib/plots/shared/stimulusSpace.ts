/**
 * A stimulus-space plot (Scanpath, Fixation Heatmap) as plain functions: the
 * input its playback shell (`components/PlaybackFigure.svelte`) reads and fills
 * with the player's state, the equal-aspect frame of `world` (gaze px) with its
 * ticks, the projection to canvas px, and the stimulus drawn under the moment
 * shown. The shell owns the runes (player, decoded media, play bar); export
 * renders through it with no clock. Kits import this.
 */
import { fitView, type Rect } from '$lib/data/media/mediaAlignment'
import type { StimulusMedia } from '$lib/data/types'
import { PLOT_BORDER_PX } from './const'
import type { PlotPlaceholderContent } from './drawCanvasPlaceholder'
import {
  gradientBandHeight,
  resolveCanvasFrame,
  type CanvasSize,
  type FrameAxes,
  type FrameGutters,
  type GradientLegendSlot,
  type PlotFrame,
} from './frame'
import type { KitChrome } from './kit'
import type { PlaybackSettings } from './playbackFields'
import { drawStimulusBackground, mediaBackground, type StimulusBackground } from './stimulusBackground'
import { linearTicks } from './ticks'

/** The settings a stimulus-space plot's shell and frame read. */
export type StimulusSettings = PlaybackSettings & {
  background: StimulusBackground
  /** The time range the data was cut to; the play span follows it. */
  timelineStart?: number
  timelineEnd?: number
  /** The one participant the plot is about (a scanpath panel): a rail hover marks it with the time. */
  participantId?: number
}

/** What every stimulus-space input carries besides its data; the shell reads the player's part. */
export interface StimulusInput {
  settings: StimulusSettings
  /**
   * Recording-time end of the data (the last fixation's end): the span's end
   * without a time range. Null when the view has nothing to play (a
   * placeholder): no play bar, an empty span.
   */
  dataEnd: number | null
  /** Why there is nothing to draw: the data placeholder. */
  unavailableMessage: PlotPlaceholderContent | null
  /** The stimulus's reference medium, drawn under the data. */
  media: StimulusMedia | null
  /** Trail length in ms; 0 = the whole range so far. */
  trailLength: number
  /** The player's live state, merged in by the shell. */
  player?: PlayerState
}

/** The player's live state as plain values: what the shell merges into the input. */
export interface PlayerState {
  /** The moment shown; null shows everything (an image's idle state). */
  playTime: number | null
  /** Trail length in ms (0 = all): the committed one, or the bar's draft while it is dragged. */
  trail: number
  isPlaying: boolean
  /** On a playback clock (screen); export has none. */
  onClock: boolean
  /** The decoded medium; null while it decodes, when it fails, or without one. */
  mediaElement: HTMLImageElement | HTMLVideoElement | null
  /** `mediaElement` when it is the stimulus's video. */
  videoElement: HTMLVideoElement | null
  /** Bumps when a seeked video frame is decoded: a new input, so the frame repaints. Never read. */
  videoFrame: number
}

/** The input's player state; without a shell (a kit test), the saved moment with no media. */
export function playerOf(input: StimulusInput): PlayerState {
  return (
    input.player ?? {
      playTime: input.settings.playTime ?? null,
      trail: input.trailLength,
      isPlaying: false,
      onClock: false,
      mediaElement: null,
      videoElement: null,
      videoFrame: 0,
    }
  )
}

/** Ticks per stimulus axis. */
const TICK_COUNT = 5

/** Data rect width/height for `world`, held within 1:3..3:1 so a thin extent stays a usable plot. */
function worldAspect(world: Rect): number {
  const a = world.height > 0 ? world.width / world.height : 1
  return Math.min(3, Math.max(1 / 3, a))
}

/** Equal-aspect view of `world` in a frame-relative box, with ticks over the gaze range it shows. */
function stimulusSpace(world: Rect, frameW: number, frameH: number) {
  const w = Math.max(1, frameW)
  const h = Math.max(1, frameH)
  const view = fitView(world, w, h, { top: 0, right: 0, bottom: 0, left: 0 })
  const minX = -view.offsetX / view.scale
  const minY = -view.offsetY / view.scale
  return {
    view,
    xTicks: linearTicks(minX, minX + w / view.scale, TICK_COUNT),
    yTicks: linearTicks(minY, minY + h / view.scale, TICK_COUNT),
  }
}

/** The equal-aspect view of a world in a frame, with its ticks. */
export type StimulusSpace = ReturnType<typeof stimulusSpace>

const stimulusAxes = (space: StimulusSpace): FrameAxes => ({
  bottom: { ticks: space.xTicks, title: 'X' },
  left: { ticks: space.yTicks, title: 'Y' },
})

/** More passes than a frame ever needs: the gutters settle in two or three. */
const MAX_FRAME_PASSES = 8

export interface StimulusChrome extends KitChrome {
  placeholder: PlotPlaceholderContent | null
  axes: FrameAxes
  gutters: FrameGutters
  gradientLegend: GradientLegendSlot | null
  /** The gaze rect the frame shows; null with a placeholder. */
  world: Rect | null
}

/**
 * A stimulus-space kit's chrome: the input's placeholder, else the frame of
 * `world`. The data rect takes the world's shape, so the axes span exactly the
 * image (or extent), and the ticks cover the gaze range that rect shows. The
 * ticks size the gutters that size the rect, so this carves the rect with
 * `resolveCanvasFrame` (the frame the engine derives) and re-ticks until the
 * rect holds still, from an empty one.
 */
export function stimulusChrome(
  input: StimulusInput,
  world: Rect | null,
  size: CanvasSize,
  gradientLegend: GradientLegendSlot | null = null
): StimulusChrome {
  const placeholder = input.unavailableMessage
  if (placeholder || !world) return { placeholder, axes: {}, gutters: {}, gradientLegend: null, world: null }
  const gutters: FrameGutters = { pad: { right: PLOT_BORDER_PX }, aspect: worldAspect(world) }
  const band = gradientBandHeight(gradientLegend, size)
  let width = 0
  let height = 0
  let axes = stimulusAxes(stimulusSpace(world, width, height))
  for (let pass = 0; pass < MAX_FRAME_PASSES; pass++) {
    const rect = resolveCanvasFrame(size, gutters, axes, band).rect
    if (rect.width === width && rect.height === height) break
    width = rect.width
    height = rect.height
    axes = stimulusAxes(stimulusSpace(world, width, height))
  }
  return { placeholder: null, axes, gutters, gradientLegend, world }
}

/** The scene part every stimulus-space kit shares: the projection, the player, and how the stimulus is drawn. */
export interface StimulusScene {
  /** The world's view in the resolved frame: the projection draw and hit-tests use. */
  space: StimulusSpace | null
  player: PlayerState
  media: StimulusMedia | null
  background: StimulusBackground
}

export function stimulusScene(input: StimulusInput, world: Rect | null, frame: PlotFrame): StimulusScene {
  return {
    space: world ? stimulusSpace(world, frame.width, frame.height) : null,
    player: playerOf(input),
    media: input.media,
    background: input.settings.background ?? 'image',
  }
}

// Eye-tracker y already grows downward, as does canvas y: no flip.
export const stimulusX = (space: StimulusSpace, wx: number, frame: PlotFrame) =>
  frame.x + wx * space.view.scale + space.view.offsetX
export const stimulusY = (space: StimulusSpace, wy: number, frame: PlotFrame) =>
  frame.y + wy * space.view.scale + space.view.offsetY

/** A gaze rect in canvas px. */
export function stimulusRect(space: StimulusSpace, rect: Rect, frame: PlotFrame): Rect {
  const s = space.view.scale
  return {
    x: stimulusX(space, rect.x, frame),
    y: stimulusY(space, rect.y, frame),
    width: rect.width * s,
    height: rect.height * s,
  }
}

/**
 * The stimulus at `rect` (gaze px) under the moment shown: the image or the
 * video's current frame in the chosen mode (see `mediaBackground`), else white
 * inside its outline. Reads the video's current frame, so call it when drawing.
 */
export function drawStimulus(ctx: CanvasRenderingContext2D, scene: StimulusScene, frame: PlotFrame, rect: Rect): void {
  const { space, player, media } = scene
  if (!space) return
  const video = player.videoElement
  const mode = mediaBackground(scene.background, {
    isVideo: media?.kind === 'video',
    playTime: player.playTime,
    onClock: player.onClock,
    frameAt: video ? video.currentTime * 1000 + (media?.startOffset ?? 0) : null,
  })
  const r = stimulusRect(space, rect, frame)
  drawStimulusBackground(ctx, player.mediaElement, r.x, r.y, r.width, r.height, mode)
}
