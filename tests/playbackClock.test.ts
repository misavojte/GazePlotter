/**
 * PLAYBACK CLOCK contract: span union, the driver's speed, seek clamping,
 * membership lifecycle, the playing time on the plot cursor's time channel
 * (scope-gated), and the scanpath's time range cut. Frame advance and video
 * slaving need a browser and are not covered here.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { PlaybackClocks } from '$lib/plots/shared/playbackClock.svelte'
import { PlotCursorState, createPlotCursorPort } from '$lib/plots/shared/plotCursor.svelte'
import { getScanpathData } from '$lib/plots/scanpath/core/transformer'
import { scanpathTrail } from '$lib/plots/scanpath/core/view'
import { FIXATION_CATEGORY_ID } from '$lib/data/binary'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { ScanpathPlotSettings } from '$lib/plots/scanpath/types'

const shared = PlaybackClocks.sharedKey
const player = (start: number, end: number, speed = 1) => ({ span: { start, end }, speed })

// Node has no animation frames; playing only needs a request id.
beforeAll(() => {
  vi.stubGlobal('requestAnimationFrame', () => 1)
  vi.stubGlobal('cancelAnimationFrame', () => {})
})

describe('clock', () => {
  it('unions the players and ignores empty spans', () => {
    const c = new PlaybackClocks().clock(shared(1))
    c.join(10, player(0, 4000))
    c.join(11, player(500, 6000))
    c.join(12, player(0, 0))
    expect(c.span).toEqual({ start: 0, end: 6000 })
  })

  it("runs at the driver's speed", () => {
    const c = new PlaybackClocks().clock(shared(1))
    c.join(10, player(0, 4000, 0.5))
    c.join(11, player(0, 4000, 2))
    expect(c.speed).toBe(0.5)
    c.play(11)
    expect(c.speed).toBe(2)
  })

  it('starts from the top when parked and clamps seeks to the span', () => {
    const c = new PlaybackClocks().clock(shared(1))
    c.join(10, player(1000, 4000))
    c.play(10)
    expect(c.time).toBe(1000)
    c.seek(-50)
    expect(c.time).toBe(1000)
    c.seek(9999)
    expect(c.time).toBe(4000)
  })

  it('pulls a stranded playhead back when the span shrinks', () => {
    const c = new PlaybackClocks().clock(shared(1))
    c.join(10, player(0, 8000))
    c.seek(7000)
    c.join(10, player(0, 5000))
    expect(c.time).toBe(5000)
  })

  it('reset parks the clock again', () => {
    const c = new PlaybackClocks().clock(shared(1))
    c.join(10, player(0, 4000))
    c.play(10)
    c.reset()
    expect(c.time).toBeNull()
    expect(c.playing).toBe(false)
  })

  it('rests at the latest rest time, plays from the start, and resets back to rest', () => {
    const c = new PlaybackClocks().clock(shared(1))
    c.join(10, { ...player(0, 8000), rest: 2000 })
    expect([c.time, c.atRest]).toEqual([2000, true])
    c.join(11, { ...player(0, 8000), rest: 3000 })
    expect(c.time).toBe(3000)
    c.play(10)
    expect([c.time, c.atRest]).toEqual([0, false])
    c.seek(5000)
    c.join(10, { ...player(0, 8000), rest: 1000 })
    expect(c.time).toBe(5000)
    c.reset()
    expect([c.time, c.atRest, c.playing]).toEqual([3000, true, false])
    c.leave(11)
    expect(c.time).toBe(1000)
  })

  it('returns to rest at the end, and holds the end without a rest time', () => {
    const tickPast = (c: ReturnType<PlaybackClocks['clock']>) =>
      (c as unknown as { tick: (now: number) => void }).tick(performance.now() + 10_000)
    const video = new PlaybackClocks().clock(shared(1))
    video.join(10, { ...player(0, 8000), rest: 2000 })
    video.play(10)
    tickPast(video)
    expect([video.time, video.atRest, video.playing]).toEqual([2000, true, false])
    const image = new PlaybackClocks().clock(shared(2))
    image.join(10, player(0, 8000))
    image.play(10)
    tickPast(image)
    expect([image.time, image.playing]).toEqual([8000, false])
  })
})

describe('membership', () => {
  it('drops the clock with its last player', () => {
    const clocks = new PlaybackClocks()
    clocks.clock(shared(1)).join(10, player(0, 4000))
    clocks.clock(shared(1)).join(11, player(0, 4000))
    const c = clocks.clock(shared(1))
    clocks.leave(shared(1), 10)
    expect(clocks.clock(shared(1))).toBe(c)
    clocks.leave(shared(1), 11)
    expect(clocks.clock(shared(1))).not.toBe(c)
  })

  it('keeps private clocks out of the stimulus readers', () => {
    const clocks = new PlaybackClocks()
    const own = clocks.clock(PlaybackClocks.privateKey(10))
    own.join(10, player(0, 4000))
    own.play(10)
    expect(clocks.playingTime(1)).toBeNull()
  })
})

describe('plot cursor port', () => {
  it('carries the playing time on the time channel of its own scope only', () => {
    const clocks = new PlaybackClocks()
    const c = clocks.clock(shared(7))
    c.join(10, player(0, 4000))
    const state = new PlotCursorState()
    const same = createPlotCursorPort(state, 1, () => 7, clocks)
    const other = createPlotCursorPort(state, 2, () => 9, clocks)
    const off = createPlotCursorPort(state, 3, () => null, clocks)
    c.seek(1200)
    // Paused: nothing is drawn.
    expect(same.times).toEqual([])
    c.play(10)
    expect(same.times).toEqual([1200])
    expect(other.times).toEqual([])
    expect(off.times).toEqual([])
    // A hover elsewhere on the stimulus joins it.
    other.publish(null)
    const hover = createPlotCursorPort(state, 4, () => 7, clocks)
    hover.publish({ times: () => [300] })
    expect(same.times).toEqual([300, 1200])
    hover.publish(null)
    c.reset()
  })

  it('is inert without clocks (export, tests)', () => {
    const port = createPlotCursorPort(new PlotCursorState(), 1, () => 7)
    expect(port.times).toEqual([])
  })
})

describe('scanpath time range', () => {
  // start, end, x (NaN = no coordinates)
  const SEGMENTS: [number, number, number][] = [
    [0, 200, 10],
    [250, 400, NaN],
    [450, 700, 30],
    [750, 1000, 40],
    [1100, 1400, 50],
  ]
  const engine = {
    getReader: () => ({
      hasSpatialData: true,
      getSegmentRange: () => ({ startIndex: 0, endIndex: SEGMENTS.length }),
      getSegmentCategory: () => FIXATION_CATEGORY_ID,
      getSegmentSpatial: (i: number) => ({ x: SEGMENTS[i][2], y: 0 }),
      getSegmentStart: (i: number) => SEGMENTS[i][0],
      getSegmentEnd: (i: number) => SEGMENTS[i][1],
    }),
  } as unknown as DataEngine
  const settings = (timelineStart: number, timelineEnd: number) =>
    ({ stimulusId: 0, participantId: 0, timelineStart, timelineEnd }) as ScanpathPlotSettings

  it('keeps overlapping fixations with their full-recording ranks', () => {
    const r = getScanpathData(engine, settings(600, 1100))
    expect(r.kind).toBe('ok')
    if (r.kind !== 'ok') return
    expect(r.data.fixations.map(f => f.rank)).toEqual([2, 3])
    expect(r.data.fixations.map(f => f.start)).toEqual([450, 750])
  })

  it('reports an empty range distinctly', () => {
    const r = getScanpathData(engine, settings(5000, 6000))
    expect(r).toEqual({ kind: 'unavailable', reason: 'none-in-range' })
  })

  it('draws everything without a range', () => {
    const r = getScanpathData(engine, settings(0, 0))
    expect(r.kind === 'ok' && r.data.fixations.map(f => f.rank)).toEqual([1, 2, 3, 4])
  })
})

describe('scanpath trail', () => {
  const engineWith = (kind: 'image' | 'video') =>
    ({ metadata: { stimuliMedia: { 0: { kind } } } }) as unknown as DataEngine

  it('defaults to 2 s on a video and All on an image; a set value wins', () => {
    expect(scanpathTrail({ stimulusId: 0 }, engineWith('video'))).toBe(2000)
    expect(scanpathTrail({ stimulusId: 0 }, engineWith('image'))).toBe(0)
    expect(scanpathTrail({ stimulusId: 0, trailLength: 0 }, engineWith('video'))).toBe(0)
    expect(scanpathTrail({ stimulusId: 0, trailLength: 500 }, engineWith('image'))).toBe(500)
  })
})
