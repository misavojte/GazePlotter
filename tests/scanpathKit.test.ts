/**
 * The Scanpath kit (`scanpath/core/kit.ts`): pure functions, so no canvas
 * host. Build a scene from a fixture, with the player's state merged in as the
 * playback shell would, then hit-test, key the overlay and draw into a
 * recording context.
 */
import { describe, expect, it, vi } from 'vitest'
import { recordingContext } from './helpers/canvasRecorder'
import { scanpathKit } from '$lib/plots/scanpath/core/kit'
import type { ScanpathInput } from '$lib/plots/scanpath/core/view'
import type { ScanpathData, ScanpathFixation, ScanpathPlotSettings } from '$lib/plots/scanpath/types'
import { resolveFrameLayout, type PlotFrame } from '$lib/plots/shared/frame'
import { NO_CURSOR } from '$lib/plots/shared/cursorMarks'
import type { PlotActions, SceneContext } from '$lib/plots/shared/kit'
import type { PlayerState, StimulusInput } from '$lib/plots/shared/stimulusSpace'
import type { StimulusMedia } from '$lib/data/types'

const fixation = (rank: number, x: number, y: number, start: number, duration: number): ScanpathFixation => ({
  rank,
  x,
  y,
  start,
  duration,
})

const FIXATIONS = [
  fixation(1, 100, 100, 0, 200),
  fixation(2, 300, 120, 300, 400),
  fixation(3, 200, 250, 800, 100),
  fixation(4, 350, 260, 1000, 300),
]

const DATA: ScanpathData = {
  fixations: FIXATIONS,
  bbox: { minX: 100, maxX: 350, minY: 100, maxY: 260 },
  minDuration: 100,
  maxDuration: 400,
}

// Unset settings fall to the kit's defaults.
const input = (over: Partial<ScanpathInput & StimulusInput> = {}): ScanpathInput => ({
  settings: { participantId: 7 } as ScanpathPlotSettings,
  data: DATA,
  dataEnd: 1300,
  unavailableMessage: null,
  media: null,
  trailLength: 0,
  ...over,
})

/** The shell's merge: the player's state over the view's input. */
const at = (playTime: number | null, over: Partial<PlayerState> = {}): Pick<StimulusInput, 'player'> => ({
  player: {
    playTime,
    trail: 0,
    isPlaying: false,
    onClock: true,
    mediaElement: null,
    videoElement: null,
    videoFrame: 0,
    ...over,
  },
})

/** Chrome, the frame usePlot carves from it, and the scene. */
function sceneOf(i: ScanpathInput, width = 600, height = 450) {
  const size = { width, height, margin: 0 }
  const chrome = scanpathKit.chrome!(i, size)
  const { rect, leftTitleOffset, bottomTitleOffset } = resolveFrameLayout(
    chrome.gutters,
    { left: 0, top: 0, right: width, bottom: height },
    chrome.axes ?? {}
  )
  const frame: PlotFrame = { ...rect, leftTitleOffset, bottomTitleOffset }
  const ctx: SceneContext<typeof chrome> = { frame, size, chrome, pixelRatio: 1, gradientLegend: null }
  return { chrome, frame, scene: scanpathKit.scene(i, ctx) }
}

function canvasAt(scene: ReturnType<typeof sceneOf>['scene'], frame: PlotFrame, f: ScanpathFixation) {
  const v = scene.space!.view
  return { x: frame.x + f.x * v.scale + v.offsetX, y: frame.y + f.y * v.scale + v.offsetY }
}

describe('scanpath kit', () => {
  it('passes the unavailable message through as the data placeholder', () => {
    const placeholder = { message: 'No fixations in the selected time range.' }
    const chrome = scanpathKit.chrome!(input({ data: null, dataEnd: null, unavailableMessage: placeholder }), {
      width: 400,
      height: 400,
      margin: 0,
    })
    expect(chrome.placeholder).toBe(placeholder)
  })

  it('frames the padded fixation extent, or the media grown to the fixations off it', () => {
    const { chrome } = sceneOf(input())
    expect(chrome.world).toEqual({ x: 87.5, y: 92, width: 275, height: 176 })
    const media: StimulusMedia = { kind: 'image', mimeType: 'image/png', fileName: 's.png', naturalWidth: 320, naturalHeight: 240 }
    expect(sceneOf(input({ media })).chrome.world).toEqual({ x: 0, y: 0, width: 350, height: 260 })
  })

  it('settles the gutters: the frame its ticks carve shows exactly those ticks', () => {
    for (const [width, height] of [[600, 450], [333, 271], [900, 300]]) {
      const { chrome, scene } = sceneOf(input(), width, height)
      expect(scene.space!.xTicks).toEqual(chrome.axes.bottom?.ticks)
      expect(scene.space!.yTicks).toEqual(chrome.axes.left?.ticks)
    }
  })

  it('shows every fixation parked, and the trail ending at the moment shown', () => {
    expect(sceneOf(input()).scene.fixations).toBe(FIXATIONS)
    const trail = sceneOf(input(at(900, { trail: 700 }))).scene
    expect(trail.trail).toEqual({ cutoff: 900, floor: 200, length: 700 })
    expect(trail.fixations.map(f => f.rank)).toEqual([2, 3])
  })

  it('hit-tests a fixation into its tooltip, and bare panel into a track-only hit', () => {
    const i = input()
    const { scene, frame } = sceneOf(i)
    const p = canvasAt(scene, frame, FIXATIONS[1])
    const hit = scanpathKit.hit!(scene, p.x + 1, p.y, frame, i)
    expect(hit?.data).toEqual({ fixationIndex: 1 })
    expect(hit?.content[0]).toEqual({ key: 'Fixation order', value: '2' })
    const bare = scanpathKit.hit!(scene, frame.x + 2, frame.bottom - 2, frame, i)
    expect(bare).toMatchObject({ content: [], data: { fixationIndex: null } })
    // A fixation the trail left behind is not hoverable.
    const later = sceneOf(input(at(900, { trail: 700 })))
    const gone = canvasAt(later.scene, later.frame, FIXATIONS[0])
    expect(scanpathKit.hit!(later.scene, gone.x, gone.y, later.frame, i)?.data).toEqual({ fixationIndex: null })
  })

  it('keys the overlay on the marked fixations, not on the cursor times', () => {
    const { scene } = sceneOf(input())
    const overlayKey = scanpathKit.overlay!.key!
    const key = (times: number[]) => overlayKey(scene, { times, participants: [] }, input())
    expect(key([350])).toBe('1')
    expect(key([350, 360])).toBe(key([350]))
    expect(key([250])).toBe('')
    expect(overlayKey(scene, NO_CURSOR, input())).toBe('')
    // A playing clock marks its own moment.
    const playing = sceneOf(input(at(1100, { isPlaying: true }))).scene
    expect(overlayKey(playing, NO_CURSOR, input())).toBe('3')
  })

  it('publishes the participant and the hovered fixation\'s midpoint, read live', () => {
    const publish = vi.fn()
    let current = input()
    const { scene, frame } = sceneOf(current)
    const act: PlotActions<ScanpathInput, typeof scene, Record<string, unknown>> = {
      scene: () => scene,
      input: () => current,
      frame: () => frame,
      settings: () => ({}),
      publish,
      toggle() {},
      draft() {},
      commit() {},
    }
    scanpathKit.hover!({ fixationIndex: 1 }, act)
    const record = publish.mock.calls[0][0]
    expect(record.participants()).toEqual([7])
    expect(record.times()).toEqual([500])
    // The data changed under a resting pointer: empty, not a stale time.
    current = { ...current, data: { ...DATA, fixations: [] } }
    expect(record.times()).toEqual([])
    scanpathKit.hover!({ fixationIndex: null }, act)
    expect(publish.mock.calls[1][0].times).toBeUndefined()
    scanpathKit.hover!(null, act)
    expect(publish).toHaveBeenLastCalledWith(null)
  })

  it('draws a marker and its halo per shown fixation, the onset key and the overlay rings', () => {
    const i = input()
    const { scene, frame } = sceneOf(i)
    const rec = recordingContext()
    scanpathKit.draw(rec.ctx, scene, frame)
    expect(rec.count('arc')).toBe(2 * FIXATIONS.length)
    expect(rec.calls.filter(c => c.method === 'strokeText').map(c => c.args[0])).toEqual(['4', '3', '2', '1'])
    scanpathKit.drawAboveAxes!(rec.ctx, scene, frame)
    expect(rec.calls.some(c => c.method === 'fillText' && c.args[0] === '0.0 s')).toBe(true)
    const before = rec.count('arc')
    scanpathKit.overlay!.draw(rec.ctx, scene, frame, { hover: { fixationIndex: 2 }, cursor: { times: [350], participants: [] }, input: i })
    // The cursor's node mark, then the hover's two rings.
    expect(rec.count('arc') - before).toBe(3)
  })
})
