/**
 * The Fixation Heatmap kit (`fixation-heatmap/core/kit.ts`): pure functions,
 * so no canvas host. Build the view's input from a test engine, add the
 * player's state as the playback shell would, then lay out, hit-test and draw
 * into a recording context.
 */
import { describe, expect, it, vi } from 'vitest'
import { ALL_CAPS, makeTestEngine } from './helpers/testEngine'
import { recordingContext } from './helpers/canvasRecorder'
import { fixationHeatmapKit } from '$lib/plots/fixation-heatmap/core/kit'
import { deriveFixationHeatmapView, type FixationHeatmapInput } from '$lib/plots/fixation-heatmap/core/view'
import type { FixationHeatmapPlotSettings } from '$lib/plots/fixation-heatmap/types'
import { resolveFrameLayout, type PlotFrame } from '$lib/plots/shared/frame'
import { PLOT_LEGEND_GAP } from '$lib/plots/shared/const'
import { getGradientLegendRequiredHeight } from '$lib/plots/shared/legendGradient'
import { NO_CURSOR } from '$lib/plots/shared/cursorMarks'
import type { PlotActions, SceneContext } from '$lib/plots/shared/kit'
import type { PlayerState, StimulusInput } from '$lib/plots/shared/stimulusSpace'
import type { StimulusMedia } from '$lib/data/types'

/** [start, end, x, y] */
type Fix = [number, number, number, number]

// Two participants on stimulus 1 inside a 0..400 x 0..300 field.
const P0: Fix[] = [
  [0, 300, 100, 100],
  [300, 500, 110, 105],
  [500, 1500, 300, 200],
]
const P1: Fix[] = [
  [0, 200, 120, 90],
  [200, 900, 290, 210],
]

const IMAGE: StimulusMedia = { kind: 'image', mimeType: 'image/png', fileName: 's.png', naturalWidth: 400, naturalHeight: 300 }

function inputOf(over: Partial<FixationHeatmapPlotSettings> = {}, media: StimulusMedia | null = IMAGE): FixationHeatmapInput {
  const stimuli = [[], [P0, P1]]
  const engine = makeTestEngine(
    stimuli.map(ps => ps.map(fs => fs.map(([s, e]) => [s, e, 0]))),
    { capabilities: ALL_CAPS, spatial: stimuli.map(ps => ps.map(fs => fs.map(([, , x, y]) => [x, y]))) }
  )
  if (media) engine.metadata!.stimuliMedia = { 1: media }
  const settings: FixationHeatmapPlotSettings = {
    stimulusId: 1,
    accumulate: 'duration',
    normalization: 'share',
    radius: 30,
    view: 'heatmap',
    colorScale: ['#ffeda0', '#fd8d3c', '#bd0026'],
    scaleMax: 0,
    opacity: 70,
    maskColor: '#000000',
    maskOpacity: 90,
    showFixations: false,
    background: 'image',
    playbackSpeed: 1,
    syncPlayback: true,
    ...over,
  }
  return deriveFixationHeatmapView(engine, settings).input
}

/** The shell's merge: the player's state over the view's input. */
const playing = (input: FixationHeatmapInput, over: Partial<PlayerState> = {}): FixationHeatmapInput & StimulusInput => ({
  ...input,
  player: {
    playTime: null,
    trail: input.trailLength,
    isPlaying: false,
    onClock: true,
    mediaElement: null,
    videoElement: null,
    videoFrame: 0,
    ...over,
  },
})

/** Chrome, the frame usePlot carves from it (the colorbar's band below), and the scene. */
function sceneOf(input: FixationHeatmapInput, width = 500, height = 450) {
  const size = { width, height, margin: 0 }
  const chrome = fixationHeatmapKit.chrome!(input, size)
  const slot = chrome.gradientLegend
  const band = slot ? PLOT_LEGEND_GAP + getGradientLegendRequiredHeight(slot.title, width) : 0
  const { rect, leftTitleOffset, bottomTitleOffset } = resolveFrameLayout(
    { ...chrome.gutters, legendHeight: band },
    { left: 0, top: 0, right: width, bottom: height },
    chrome.axes ?? {}
  )
  const frame: PlotFrame = { ...rect, leftTitleOffset, bottomTitleOffset }
  const ctx: SceneContext<typeof chrome> = { frame, size, chrome, pixelRatio: 1, gradientLegend: null }
  return { chrome, ctx, frame, scene: fixationHeatmapKit.scene(input, ctx) }
}

/** Canvas point of a gaze point under the scene's projection. */
function canvasAt(scene: ReturnType<typeof sceneOf>['scene'], frame: PlotFrame, wx: number, wy: number) {
  const v = scene.space!.view
  return { x: frame.x + wx * v.scale + v.offsetX, y: frame.y + wy * v.scale + v.offsetY }
}

describe('fixation heatmap kit', () => {
  it('passes the unavailable message through as the data placeholder', () => {
    const unavailable = inputOf({ timelineStart: 5000 })
    const chrome = fixationHeatmapKit.chrome!(unavailable, { width: 400, height: 400, margin: 0 })
    expect(chrome.placeholder).toBe(unavailable.unavailableMessage)
    expect(chrome.placeholder).toMatchObject({ message: 'No fixations in the selected time range.' })
    expect(unavailable.dataEnd).toBeNull()
  })

  it('frames the media rect with ticks over it, and a colorbar titled for the range', () => {
    const input = inputOf()
    const { chrome, frame } = sceneOf(input)
    expect(chrome.world).toEqual({ x: 0, y: 0, width: 400, height: 300 })
    expect(chrome.gutters.aspect).toBeCloseTo(4 / 3)
    expect(frame.width / frame.height).toBeCloseTo(4 / 3, 1)
    expect(chrome.axes.bottom?.ticks?.labels).toContain('0')
    expect(chrome.gradientLegend?.title).toBe(input.legendTitle)
  })

  it('settles the gutters: the frame its ticks carve shows exactly those ticks', () => {
    for (const [width, height] of [[500, 450], [333, 271], [900, 380]]) {
      const { chrome, scene } = sceneOf(inputOf(), width, height)
      expect(scene.space!.xTicks).toEqual(chrome.axes.bottom?.ticks)
      expect(scene.space!.yTicks).toEqual(chrome.axes.left?.ticks)
    }
  })

  it('shows the parked map at rest, and the window\'s frame at a moment', () => {
    const input = inputOf()
    expect(sceneOf(input).scene.shown).toBe(input.data)
    const moment = playing(input, { playTime: 400, trail: 0 })
    const { chrome, scene } = sceneOf(moment)
    expect(chrome.window).toEqual({ start: 0, end: 400 })
    expect(chrome.gradientLegend?.title).toContain('400')
    expect(scene.shown).not.toBe(input.data)
    expect(scene.shown!.summary.fixations).toBe(4)
  })

  it('keeps the frame and the colour table across rebuilds of one moment (a resize)', () => {
    const moment = playing(inputOf(), { playTime: 400, trail: 0 })
    const a = sceneOf(moment, 500, 450).scene
    const b = sceneOf(moment, 700, 600).scene
    expect(b.shown).toBe(a.shown)
    expect(b.lut).toBe(a.lut)
    // The next moment is a new frame.
    expect(sceneOf(playing(inputOf(), { playTime: 600 })).scene.shown).not.toBe(a.shown)
  })

  it('hit-tests a looked-at cell into its tooltip and payload, and empty space into a track-only hit', () => {
    const input = inputOf()
    const { scene, frame } = sceneOf(input)
    const at = canvasAt(scene, frame, 105, 102)
    const hit = fixationHeatmapKit.hit!(scene, at.x, at.y, frame, input)
    expect(hit?.data?.cell).toBeGreaterThanOrEqual(0)
    expect(hit?.content.find(r => r.key === 'Participants')?.value).toBe('2 of 2')
    const empty = canvasAt(scene, frame, 395, 5)
    const none = fixationHeatmapKit.hit!(scene, empty.x, empty.y, frame, input)
    expect(none?.content).toEqual([])
  })

  it('publishes the participants within R of the hovered cell', () => {
    const input = inputOf()
    const { scene, frame } = sceneOf(input)
    const at = canvasAt(scene, frame, 105, 102)
    const hit = fixationHeatmapKit.hit!(scene, at.x, at.y, frame, input)!
    const publish = vi.fn()
    const act: PlotActions<FixationHeatmapInput, typeof scene, Record<string, unknown>> = {
      scene: () => scene,
      input: () => input,
      frame: () => frame,
      settings: () => ({}),
      publish,
      toggle() {},
      draft() {},
      commit() {},
    }
    fixationHeatmapKit.hover!(hit.data!, act)
    expect(publish.mock.calls[0][0].participants()).toEqual([0, 1])
    fixationHeatmapKit.hover!(null, act)
    expect(publish).toHaveBeenLastCalledWith(null)
  })

  it('draws the media, the dots and the hover ring', () => {
    const input = inputOf({ showFixations: true })
    const { scene, frame } = sceneOf(input)
    const rec = recordingContext()
    fixationHeatmapKit.draw(rec.ctx, scene, frame)
    // White inside the media outline (no decoded image), then a halo and a dot per fixation.
    expect(rec.count('fillRect')).toBe(1 + 2 * 5)
    fixationHeatmapKit.overlay!.draw(rec.ctx, scene, frame, { hover: { cell: 0 }, cursor: NO_CURSOR, input })
    expect(rec.count('arc')).toBe(1)
  })
})
