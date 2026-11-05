/**
 * PLAYBACK CLOCK contract: seek clamping, rest and saved moments, membership
 * lifecycle, playing together (a run: one start, one speed, one pause, each on
 * its own span), the playing times on the plot cursor's time channel
 * (scope-gated), and the scanpath's time range cut. Frame advance and video
 * slaving need a browser and are not covered here.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { PlaybackClocks, type PlaybackClock } from '$lib/plots/shared/playbackClock.svelte'
import { PlotCursorState, createPlotCursorPort } from '$lib/plots/shared/plotCursor.svelte'
import { getScanpathData } from '$lib/plots/scanpath/core/transformer'
import { trailLengthOf } from '$lib/plots/shared/playbackFields'
import { mediaBackground } from '$lib/plots/shared/stimulusBackground'
import { FIXATION_CATEGORY_ID } from '$lib/data/binary'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { ScanpathPlotSettings } from '$lib/plots/scanpath/types'

const player = (start: number, end: number, speed = 1) => ({ span: { start, end }, speed })
/** A clock for plot 10 on stimulus 1, unless told otherwise. */
const clockOf = (clocks = new PlaybackClocks(), plotId = 10, stimulusId = 1) =>
  clocks.open(plotId, () => stimulusId)
const tickPast = (c: PlaybackClock) =>
  (c as unknown as { tick: (now: number) => void }).tick(performance.now() + 10_000)

// Node has no animation frames; playing only needs a request id.
beforeAll(() => {
  vi.stubGlobal('requestAnimationFrame', () => 1)
  vi.stubGlobal('cancelAnimationFrame', () => {})
})

describe('clock', () => {
  it('has no span before its player, or with an empty one', () => {
    const c = clockOf()
    expect(c.span).toEqual({ start: 0, end: 0 })
    c.setPlayer(player(0, 0))
    c.play()
    expect(c.playing).toBe(false)
  })

  it('starts from the top when parked and clamps seeks to the span', () => {
    const c = clockOf()
    c.setPlayer(player(1000, 4000))
    c.play()
    expect(c.time).toBe(1000)
    c.seek(-50)
    expect(c.time).toBe(1000)
    c.seek(9999)
    expect(c.time).toBe(4000)
  })

  it('pulls a stranded playhead back when the span shrinks', () => {
    const c = clockOf()
    c.setPlayer(player(0, 8000))
    c.seek(7000)
    c.setPlayer(player(0, 5000))
    expect(c.time).toBe(5000)
  })

  it('reset parks the clock again', () => {
    const c = clockOf()
    c.setPlayer(player(0, 4000))
    c.play()
    c.reset()
    expect(c.time).toBeNull()
    expect(c.playing).toBe(false)
  })

  it('rests at its rest time, plays from the start, and resets back to rest', () => {
    const c = clockOf()
    c.setPlayer({ ...player(0, 8000), rest: 2000 })
    expect(c.time).toBe(2000)
    c.play()
    expect(c.time).toBe(0)
    c.seek(5000)
    c.setPlayer({ ...player(0, 8000), rest: 1000 })
    expect(c.time).toBe(5000)
    c.reset()
    expect([c.time, c.playing]).toEqual([1000, false])
  })

  it('returns to rest at the end, and holds the end without a rest time', () => {
    const video = clockOf()
    video.setPlayer({ ...player(0, 8000), rest: 2000 })
    video.play()
    tickPast(video)
    expect([video.time, video.playing]).toEqual([2000, false])
    const image = clockOf()
    image.setPlayer(player(0, 8000))
    image.play()
    tickPast(image)
    expect([image.time, image.playing]).toEqual([8000, false])
  })

  it('moves a paused clock to a changed saved moment, and plays on from it', () => {
    const c = clockOf()
    // The placeholder first, then the figure with its saved moment (a load).
    c.setPlayer(player(0, 0))
    c.setPlayer({ ...player(0, 8000), rest: 2000, saved: 5000 })
    expect(c.moment).toBe(5000)
    // An unchanged moment keeps a later seek.
    c.seek(6000)
    c.setPlayer({ ...player(0, 8000), rest: 2000, saved: 5000 })
    expect(c.time).toBe(6000)
    // A changed one (undo) moves it; cleared, it parks at rest.
    c.setPlayer({ ...player(0, 8000), rest: 2000, saved: 4000 })
    expect(c.time).toBe(4000)
    c.setPlayer({ ...player(0, 8000), rest: 2000, saved: null })
    expect([c.time, c.moment]).toEqual([2000, null])
    c.setPlayer({ ...player(0, 8000), rest: 2000, saved: 4000 })
    c.play()
    expect(c.time).toBe(4000)
  })

  it('ignores a saved moment while playing', () => {
    const c = clockOf()
    c.setPlayer(player(0, 8000))
    c.play()
    c.seek(1000)
    c.setPlayer({ ...player(0, 8000), saved: 5000 })
    expect(c.time).toBe(1000)
  })
})

describe('membership', () => {
  it('drops a closed clock, but not a newer one of the same plot', () => {
    const clocks = new PlaybackClocks()
    const old = clockOf(clocks)
    const fresh = clockOf(clocks)
    clocks.close(old)
    expect(clocks.get(10)).toBe(fresh)
    clocks.close(fresh)
    expect(clocks.get(10)).toBeUndefined()
  })

  it('stops a clock on close', () => {
    const clocks = new PlaybackClocks()
    const c = clockOf(clocks)
    c.setPlayer(player(0, 4000))
    c.play()
    clocks.close(c)
    expect(c.playing).toBe(false)
  })
})

describe('playing together', () => {
  const pair = () => {
    const clocks = new PlaybackClocks()
    const heatmap = clockOf(clocks, 10)
    heatmap.setPlayer(player(0, 60_000))
    const scanpath = clockOf(clocks, 11)
    scanpath.setPlayer(player(0, 10_000, 2))
    return { clocks, heatmap, scanpath }
  }

  it('plays alone without mates, each clock on its own span', () => {
    const { heatmap, scanpath } = pair()
    heatmap.toggle()
    expect([heatmap.playing, scanpath.playing]).toEqual([true, false])
    expect(heatmap.span).toEqual({ start: 0, end: 60_000 })
    expect(scanpath.span).toEqual({ start: 0, end: 10_000 })
  })

  it("starts the mates at the starter's moment and speed", () => {
    const { heatmap, scanpath } = pair()
    heatmap.seek(4000)
    heatmap.toggle([scanpath])
    expect([heatmap.time, scanpath.time]).toEqual([4000, 4000])
    expect([heatmap.playing, scanpath.playing]).toEqual([true, true])
    expect(scanpath.speed).toBe(1)
  })

  it('ends a short member on its own and pauses the whole run together', () => {
    const { heatmap, scanpath } = pair()
    heatmap.toggle([scanpath])
    tickPast(scanpath)
    expect([heatmap.playing, scanpath.playing, scanpath.time]).toEqual([true, false, 10_000])
    // A seek during the run brings an ended member back.
    heatmap.scrub(3000)
    expect([scanpath.playing, scanpath.time]).toEqual([true, 3000])
    scanpath.toggle()
    expect([heatmap.playing, scanpath.playing]).toEqual([false, false])
  })

  it('seeks alone while paused, and plays alone again without mates', () => {
    const { heatmap, scanpath } = pair()
    heatmap.toggle([scanpath])
    heatmap.toggle()
    heatmap.scrub(20_000)
    expect(scanpath.time).not.toBe(20_000)
    scanpath.toggle()
    expect([heatmap.playing, scanpath.playing, scanpath.speed]).toEqual([false, true, 2])
  })

  it('skips mates with nothing to play', () => {
    const { clocks, heatmap } = pair()
    const empty = clockOf(clocks, 12)
    heatmap.toggle([empty])
    expect([heatmap.playing, empty.playing, heatmap.run]).toEqual([true, false, null])
  })
})

describe('plot cursor port', () => {
  it('carries the playing times on the time channel of their stimulus only', () => {
    const clocks = new PlaybackClocks()
    const c = clockOf(clocks, 10, 7)
    c.setPlayer(player(0, 4000))
    const d = clockOf(clocks, 11, 7)
    d.setPlayer(player(0, 4000))
    const state = new PlotCursorState()
    const same = createPlotCursorPort(state, 1, () => 7, clocks)
    const other = createPlotCursorPort(state, 2, () => 9, clocks)
    const off = createPlotCursorPort(state, 3, () => null, clocks)
    c.seek(1200)
    // Paused: nothing is drawn.
    expect(same.times).toEqual([])
    c.play()
    expect(same.times).toEqual([1200])
    expect(other.times).toEqual([])
    expect(off.times).toEqual([])
    d.play(2500)
    expect(same.times).toEqual([1200, 2500])
    d.reset()
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

describe('trail length', () => {
  const engineWith = (kind: 'image' | 'video') =>
    ({ metadata: { stimuliMedia: { 0: { kind } } } }) as unknown as DataEngine

  it('defaults to 2 s on a video and All on an image; a set value wins', () => {
    expect(trailLengthOf({ stimulusId: 0 }, engineWith('video'))).toBe(2000)
    expect(trailLengthOf({ stimulusId: 0 }, engineWith('image'))).toBe(0)
    expect(trailLengthOf({ stimulusId: 0, trailLength: 0 }, engineWith('video'))).toBe(0)
    expect(trailLengthOf({ stimulusId: 0, trailLength: 500 }, engineWith('image'))).toBe(500)
  })
})

describe('saved moment (export parity)', () => {
  it('saves the paused time, and nothing while the clock rests', () => {
    const c = clockOf()
    c.setPlayer({ ...player(0, 8000), rest: 2000 })
    expect(c.moment).toBeNull()
    c.seek(4500)
    expect(c.moment).toBe(4500)
    c.reset()
    expect(c.moment).toBeNull()
    const image = clockOf()
    image.setPlayer(player(0, 8000))
    expect(image.moment).toBeNull()
  })

  it('draws a video only under the moment shown', () => {
    const at = (s: Partial<Parameters<typeof mediaBackground>[1]>) =>
      mediaBackground('image', { isVideo: true, playTime: 3000, onClock: false, frameAt: 3000, ...s })
    // An image is always drawn.
    expect(mediaBackground('image', { isVideo: false, playTime: null, onClock: false, frameAt: null })).toBe('image')
    // A video under everything: white.
    expect(at({ playTime: null, onClock: true })).toBe('none')
    // On a clock, the clock has the element on its frame.
    expect(at({ onClock: true, frameAt: 0 })).toBe('image')
    // Export: only when the shared element shows the moment's frame.
    expect(at({})).toBe('image')
    expect(at({ frameAt: 3040 })).toBe('image')
    expect(at({ frameAt: 0.001 })).toBe('none')
    expect(at({ frameAt: null })).toBe('none')
  })
})
