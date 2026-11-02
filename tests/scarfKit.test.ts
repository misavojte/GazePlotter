/**
 * The scarf kit (`scarf/core/kit.ts`). Pure functions, so no canvas host: build
 * the chrome, resolve the frame the way the harness does, build a scene, then
 * hit-test, publish, pan and draw it into a recording context.
 */
import { describe, expect, it, vi } from 'vitest'
import { makeTestEngine } from './helpers/testEngine'
import { recordingContext } from './helpers/canvasRecorder'
import { FIXATION_CATEGORY_ID } from '../src/lib/data/binary/schema'
import {
  deriveScarfView,
  getScarfData,
  isAutoRange,
  scarfOwnMax,
  type ScarfInput,
} from '$lib/plots/scarf/core/view'
import { scarfKit } from '$lib/plots/scarf/core/kit'
import { NO_CURSOR, timeAtX, timeGuideX } from '$lib/plots/shared/cursorMarks'
import { resolveFrameLayout, type PlotFrame } from '$lib/plots/shared/frame'
import type { PlotActions, SceneContext } from '$lib/plots/shared/kit'
import type { ScarfData, ScarfPlotSettings } from '$lib/plots/scarf/types'

const SETTINGS: ScarfPlotSettings = {
  stimulusId: 1,
  timeline: 'absolute',
  absoluteStimuliLimits: [],
  ordinalStimuliLimits: [],
  timelineStart: 0,
  timelineEnd: 0,
}

/** Two participants over [0, 400] ms; participant 0 has one event [50, 150]. */
function buildEngine(withEvents: boolean, participants = 2) {
  const rows = [
    [
      [0, 100, FIXATION_CATEGORY_ID, 1],
      [110, 210, 1],
      [220, 400, FIXATION_CATEGORY_ID, 2],
    ],
    [
      [0, 200, FIXATION_CATEGORY_ID, 2],
      [300, 400, FIXATION_CATEGORY_ID],
    ],
  ].slice(0, participants)
  return makeTestEngine([[], rows], {
    aoiData: [[], [null, ['A1', 'A1', '#e41a1c'], ['A2', 'A2', '#377eb8']]],
    aoiOrderVector: [[], [1, 2]],
    categories: [
      ['Fixation', 'Fixation', '#000000'],
      ['Saccade', 'Saccade', '#cccccc'],
    ],
    ...(withEvents
      ? {
          eventData: [[], [['Ev', 'Ev', '#3366cc']]],
          eventOrderVector: [[], [0]],
          events: [[], [[[50, 100], []]]],
        }
      : {}),
    aoiMapping: 'group',
  })
}

function buildData(withEvents: boolean, participants = 2): ScarfData {
  return getScarfData(buildEngine(withEvents, participants), SETTINGS)!
}

function input(data: ScarfData, over: Partial<ScarfInput> = {}): ScarfInput {
  return {
    data,
    settings: SETTINGS,
    dataMax: 400,
    highlights: [],
    getTooltipContent: (pid, order) => [{ key: 'Segment', value: `${pid}:${order}` }],
    ...over,
  }
}

/** The harness's frame for this chrome, then the scene. */
function sceneOf(i: ScarfInput, width = 800, height = 400, pixelRatio = 1) {
  const size = { width, height, margin: 0 }
  const chrome = scarfKit.chrome!(i, size)
  const { rect, leftTitleOffset, bottomTitleOffset } = resolveFrameLayout(
    chrome.gutters ?? {},
    { left: 0, top: 0, right: width, bottom: height },
    chrome.axes ?? {}
  )
  const frame: PlotFrame = { ...rect, leftTitleOffset, bottomTitleOffset }
  const ctx: SceneContext<typeof chrome> = { frame, size, chrome, pixelRatio, gradientLegend: null }
  return { scene: scarfKit.scene(i, ctx), ctx, frame, chrome }
}

type Scene = ReturnType<typeof sceneOf>['scene']

/** Canvas x of a time in row `row` (the row's own projection). */
function xAt(scene: Scene, frame: PlotFrame, row: number, t: number) {
  const gs = scene.data.gazeSource
  return frame.x + (t - gs.projClipMin[row]) * gs.projScale[row] * frame.width
}

/**
 * The platform's actions over a live scene and input, recording what the kit
 * asks for; `draft` previews over the input's settings, as the host does.
 */
function actsOf(scene: () => Scene, i: () => ScarfInput, frame: PlotFrame) {
  let draft: Partial<ScarfPlotSettings> = {}
  return {
    scene,
    input: i,
    frame: () => frame,
    settings: () => ({ ...i().settings, ...draft }),
    publish: vi.fn(),
    toggle: vi.fn(),
    draft: vi.fn((patch: Partial<ScarfPlotSettings>) => {
      draft = { ...draft, ...patch }
    }),
    commit: vi.fn(() => {
      draft = {}
    }),
  } satisfies PlotActions<ScarfInput, Scene, ScarfPlotSettings>
}

describe('scarf kit', () => {
  it('has no data placeholder; reserves the label column and caps the frame at the row stack', () => {
    const { chrome } = sceneOf(input(buildData(false)))
    expect('placeholder' in chrome).toBe(false)
    expect(chrome.axes.bottom?.title).toBe('Elapsed time / ms')
    expect(chrome.gutters.pad?.left).toBe(chrome.labelColumn.width)
    expect(chrome.gutters.maxHeight).toBe(Math.ceil(2 * chrome.layout.heightOfBarWrap))
    expect(chrome.labelColumn.labels).toEqual(['P0', 'P1'])
  })

  it('lays the rows from the frame top, one pitch per participant', () => {
    const { scene, frame } = sceneOf(input(buildData(false)), 800, 400, 2)
    const pitch = scene.layout.heightOfBarWrap
    expect(scene.rowBand).toEqual({ x: frame.x, y: frame.y, width: frame.width, height: 2 * pitch })
    expect(scene.render.plotLeft).toBe(frame.x)
    expect(scene.render.plotTop).toBe(frame.y)
    expect(scene.render.deviceScale).toBe(2)
    // The legend sits below the x-axis gutter.
    expect(scene.legendGeometry.items.length).toBeGreaterThan(0)
    expect(scene.legendGeometry.items[0].y).toBeGreaterThan(frame.bottom)
  })

  it('builds the style arrays and ids once per data, not per resize', () => {
    const data = buildData(false)
    const a = sceneOf(input(data), 800, 400).scene
    const b = sceneOf(input(data), 640, 360).scene
    expect(b.rectStyleArray).toBe(a.rectStyleArray)
    expect(b.eventStyleArray).toBe(a.eventStyleArray)
    expect(b.identifierSystem).toBe(a.identifierSystem)
    expect(b.timeAxis.rowIds).toBe(a.timeAxis.rowIds)
    const other = sceneOf(input(buildData(false)), 800, 400).scene
    expect(other.rectStyleArray).not.toBe(a.rectStyleArray)
    expect(a.timeAxis.rowIds).toEqual(data.participants.map(p => p.id))
  })

  it('masks only the highlighted identifiers', () => {
    const data = buildData(false)
    expect(sceneOf(input(data)).scene.highlightMask).toBeNull()
    const id = data.stylingAndLegend.aoi[1].identifier
    const { scene } = sceneOf(input(data, { highlights: [id] }))
    const idx = scene.identifierSystem.idToIndex.get(id)!
    expect(scene.highlightMask?.[idx]).toBe(1)
    expect([...scene.highlightMask!].reduce((s, v) => s + v, 0)).toBe(1)
    expect(scene.markers.highlightMask).toBe(scene.highlightMask)
  })

  it('guards a row band too short to read, naming the eye-movement selection', () => {
    const big = sceneOf(input(buildData(false)))
    expect(scarfKit.fit!(big.scene, big.ctx)).toBeNull()
    const tiny = sceneOf(input(buildData(false)), 800, 120)
    const placeholder = scarfKit.fit!(tiny.scene, tiny.ctx)
    expect(typeof placeholder === 'object' && placeholder?.steps).toContain(
      'Pick a narrower selection in Plot Settings > Eye-movement Types'
    )
  })

  it('hit-tests a segment into its tooltip, a gap into a track-only hit', () => {
    const data = buildData(false)
    const i = input(data)
    const { scene, frame } = sceneOf(i)
    const pitch = scene.layout.heightOfBarWrap
    const y = frame.y + pitch * 0.5
    const mx = xAt(scene, frame, 0, 50)
    const hit = scarfKit.hit!(scene, mx, y, frame, i)
    expect(hit?.content).toEqual([{ key: 'Segment', value: `${data.participants[0].id}:0` }])
    expect(hit?.data).toEqual({ row: 0, x: mx })
    // The 100–110 ms gap: crosshair only.
    const gapX = xAt(scene, frame, 0, 105)
    const gap = scarfKit.hit!(scene, gapX, y, frame, i)
    expect(gap?.content).toEqual([])
    expect(gap?.data).toEqual({ row: 0, x: gapX })
    // The second row hits; below the last row is outside.
    expect(scarfKit.hit!(scene, mx, frame.y + 1.5 * pitch, frame, i)?.data).toEqual({ row: 1, x: mx })
    expect(scarfKit.hit!(scene, mx, frame.y + 2 * pitch + 2, frame, i)).toBeNull()
  })

  it('hit-tests an event strip into the event tooltip', () => {
    const i = input(buildData(true))
    const { scene, frame } = sceneOf(i)
    expect(scene.data.isOverlay).toBe(true)
    const { eventBandTop, eventLaneHeight } = scene.layout
    const y = frame.y + eventBandTop + eventLaneHeight / 2
    const hit = scarfKit.hit!(scene, xAt(scene, frame, 0, 100), y, frame, i)
    expect(hit?.content).toEqual([
      { key: 'Participant', value: 'P0' },
      { key: 'Event', value: 'Ev' },
      { key: 'Start', value: '50.0 ms' },
      { key: 'End', value: '150.0 ms' },
      { key: 'Duration', value: '100.0 ms' },
    ])
    expect(hit?.data?.row).toBe(0)
  })

  it('keys the overlay on guide columns and marked rows, not on the cursor arrays', () => {
    const data = buildData(false)
    const { scene, frame } = sceneOf(input(data))
    const key = (times: number[], participants: number[] = []) =>
      scarfKit.overlay!.key!(scene, { times, participants }, input(data))
    expect(scarfKit.overlay!.key!(scene, NO_CURSOR, input(data))).toBe(':')
    // Two instants inside one pixel column share a key.
    const t = timeAtX(scene.rowBand, data.timeline, frame.x + 100.2)
    const t2 = timeAtX(scene.rowBand, data.timeline, frame.x + 100.4)
    expect(key([t])).toBe(key([t2]))
    expect(key([t])).toBe(`${timeGuideX(scene.rowBand, data.timeline, t)}:`)
    expect(key([], [data.participants[1].id, 999])).toBe(':1')
  })

  it('publishes live cursor reads on hover and retracts on leave', () => {
    const data = buildData(false)
    let current = sceneOf(input(data))
    const act = actsOf(() => current.scene, () => input(data), current.frame)
    const x = current.frame.x + current.frame.width / 2
    scarfKit.hover!({ row: 1, x }, act)
    const at = act.publish.mock.calls[0][0]
    expect(at.times()).toEqual([timeAtX(current.scene.rowBand, data.timeline, x)])
    expect(at.participants()).toEqual([data.participants[1].id])
    // An undo that narrows the rows under a resting pointer reads back empty.
    current = sceneOf(input(buildData(false, 1)))
    expect(at.participants()).toEqual([])
    scarfKit.hover!(null, act)
    expect(act.publish).toHaveBeenLastCalledWith(null)
  })

  it('pans as a draft, commits it once on release, and toggles legend highlights', () => {
    const data = buildData(false)
    let i = input(data)
    const { scene, frame } = sceneOf(i, 800, 400)
    const act = actsOf(() => scene, () => i, frame)
    const handlers = scarfKit.pointer!(act)
    const press = () => handlers.onDown!({ x: 0, y: 0, isOver: true, buttons: 1 })
    const drag = (dx: number) =>
      handlers.onDrag!({ x: 0, y: 0, startX: 0, startY: 0, dx, dy: 0, totalDx: dx, totalDy: 0, isOver: true, buttons: 1 })
    const release = (dragged: boolean) =>
      handlers.onUp!({ x: 0, y: 0, isOver: true, buttons: 0, dragged })

    // Dragging left by 40 of 800 canvas px shows a window 1/20 later; a
    // sub-pixel step drafts nothing.
    const { minValue: lo, maxValue: hi } = data.timeline
    const shift = (40 * (hi - lo)) / 800
    const panned = { timelineStart: lo + shift, timelineEnd: hi + shift }
    press()
    drag(-40)
    drag(0.3)
    expect(act.draft.mock.calls).toEqual([[panned]])
    release(true)
    expect(act.commit.mock.calls).toEqual([[panned]])

    // Panned back to 0 with the end at the data max: commits auto (0).
    i = input(data, { settings: { ...SETTINGS, timelineStart: 20, timelineEnd: 420 } })
    press()
    drag(100)
    expect(act.draft).toHaveBeenLastCalledWith({ timelineStart: 0, timelineEnd: 400 })
    release(true)
    expect(act.commit).toHaveBeenLastCalledWith({ timelineStart: 0, timelineEnd: 0 })

    // A drag that never moved x (or a plain click) commits nothing.
    press()
    drag(0)
    release(true)
    press()
    release(false)
    expect(act.commit).toHaveBeenCalledTimes(2)

    const item = scene.legendGeometry.items[0]
    handlers.onDown!({ x: item.x + 2, y: item.y + item.height / 2, isOver: true, buttons: 1 })
    expect(act.toggle).toHaveBeenCalledWith('highlights', item.identifier)

    i = input(data)
    const inside = [frame.x + 10, frame.y + 5] as const
    expect(handlers.ownsDragAt!(...inside)).toBe(true)
    expect(handlers.ownsDragAt!(frame.x - 5, frame.y + 5)).toBe(false)
    // A relative timeline has nothing to drag; read live from the input.
    i = input(data, { settings: { ...SETTINGS, timeline: 'relative' } })
    expect(handlers.ownsDragAt!(...inside)).toBe(false)
  })

  it('blocks the row band for the grid', () => {
    const { scene, frame } = sceneOf(input(buildData(false)))
    expect(scarfKit.blockedRegions!(scene, frame)).toEqual([
      { x: scene.rowBand.x, y: scene.rowBand.y, w: scene.rowBand.width, h: scene.rowBand.height },
    ])
  })

  it('draws data and overlay into a recording context', () => {
    for (const withEvents of [false, true]) {
      const data = buildData(withEvents)
      const id = data.stylingAndLegend.aoi[0].identifier
      const i = input(data, { highlights: [id] })
      const { scene, frame } = sceneOf(i)
      const rec = recordingContext()
      scarfKit.draw(rec.ctx, scene, frame)
      // >=1px segments are exact fillRects (the sub-pixel blit no-ops without a canvas).
      expect(rec.count('fillRect')).toBeGreaterThan(0)
      expect(rec.count('fillText')).toBeGreaterThan(0)

      const over = recordingContext()
      scarfKit.overlay!.draw(over.ctx, scene, frame, {
        hover: { row: 0, x: frame.x + 40 },
        cursor: { times: [100], participants: [data.participants[1].id] },
        input: i,
      })
      // Time guide + crosshair strokes; two row strips.
      expect(over.count('stroke')).toBeGreaterThan(0)
    }
  })

  it('derives the pan release max and the segment tooltip from the engine', () => {
    const engine = buildEngine(false)
    const view = deriveScarfView(engine, SETTINGS)!
    expect(view.input.dataMax).toBe(400)
    expect(scarfOwnMax(engine, { ...SETTINGS, timeline: 'ordinal' })).toBe(3)
    expect(scarfOwnMax(engine, { ...SETTINGS, timeline: 'relative' })).toBe(0)
    const pid = view.input.data.participants[0].id
    expect(view.input.getTooltipContent(pid, 0)).toContainEqual({ key: 'Duration', value: '100.0 ms' })
    // `highlights` are the platform's to merge (`view.viewOnly`).
    expect(view.input).not.toHaveProperty('highlights')
  })

  it('joins the timeline sync only with a fully auto range', () => {
    expect(isAutoRange(SETTINGS)).toBe(true)
    expect(isAutoRange({ ...SETTINGS, timelineEnd: 300 })).toBe(false)
    expect(isAutoRange({ ...SETTINGS, absoluteStimuliLimits: [[0, 0], [0, 300]] })).toBe(false)
    // An ordinal range is its own keys.
    expect(isAutoRange({ ...SETTINGS, timeline: 'ordinal', timelineEnd: 300 })).toBe(true)
    expect(isAutoRange({ ...SETTINGS, timeline: 'relative' })).toBe(false)
  })
})
