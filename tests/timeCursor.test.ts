/**
 * TIME CURSOR contract: the port's scope/ownership algebra, the projection pair,
 * the mark, the scarf's mode gate, and export inertness. Not covered (node suite,
 * nothing mounts): `usePlot`'s `overlayDeps` repaint and the `onDestroy` retraction.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  drawTimeCursor,
  timeAtX,
  timeCursorPort,
  timeCursorX,
} from '$lib/plots/shared/timeCursor.svelte'
import { absoluteTimeScope } from '$lib/plots/scarf/core/screen.svelte'
import { CROSSHAIR_COLOR } from '$lib/plots/shared/canvasUtils'
import type { ScarfPlotSettings } from '$lib/plots/scarf/types'

const BAND = { x: 100, y: 50, width: 400, height: 200 }
const TIMELINE = { minValue: 0, maxValue: 1000 }
/** A panned window: pins the `minValue` offset both maps must carry. */
const WINDOW = { minValue: 1000, maxValue: 3000 }

/** Records what `strokeCrosshairGuides` batches, plus the clip rect and stroke. */
function recorder() {
  const points: number[] = []
  const clips: number[] = []
  const dashes: number[][] = []
  const ctx = {
    save() {}, restore() {}, beginPath() {}, stroke() {},
    setLineDash(d: number[]) { dashes.push(d) },
    strokeStyle: '', lineWidth: 0,
    rect(x: number, y: number, w: number, h: number) { clips.push(x, y, w, h) },
    clip() {},
    moveTo(x: number, y: number) { points.push(x, y) },
    lineTo(x: number, y: number) { points.push(x, y) },
  } as unknown as CanvasRenderingContext2D
  return { points, clips, dashes, ctx }
}

// Module singleton (one pointer exists) — retract between cases.
const a = timeCursorPort(1, () => 7)
const b = timeCursorPort(2, () => 7)
const otherStimulus = timeCursorPort(3, () => 9)
const notAbsolute = timeCursorPort(4, () => null)
afterEach(() => {
  a.publish(null)
  b.publish(null)
  otherStimulus.publish(null)
})

describe('time cursor scope', () => {
  it('marks siblings on the same stimulus and never the publisher itself', () => {
    a.publish(() => 500)
    expect(b.time).toBe(500)
    expect(a.time).toBeNull()
  })

  it('does not cross stimuli', () => {
    a.publish(() => 500)
    expect(otherStimulus.time).toBeNull()
  })

  it('treats 0 ms as a real position', () => {
    a.publish(() => 0)
    expect(b.time).toBe(0)
  })

  it('neither publishes nor marks without a scope (ordinal / relative axes)', () => {
    notAbsolute.publish(() => 500)
    expect(b.time).toBeNull()
    a.publish(() => 500)
    expect(notAbsolute.time).toBeNull()
  })

  it('lets only the publisher retract', () => {
    a.publish(() => 500)
    b.publish(null)
    expect(b.time).toBe(500)
    a.publish(null)
    expect(b.time).toBeNull()
  })

  it('hands ownership to the last publisher', () => {
    a.publish(() => 500)
    b.publish(() => 700)
    expect(a.time).toBe(700)
    expect(b.time).toBeNull()
  })

  it('re-reads the publisher live, so losing its scope drops the mark', () => {
    // An undo switching a scarf to 'ordinal' under a resting pointer: no pointer
    // event fires, so a snapshot would strand the mark on every sibling.
    let mode: 'absolute' | 'ordinal' = 'absolute'
    const scarf = timeCursorPort(5, () => (mode === 'absolute' ? 7 : null))
    scarf.publish(() => 500)
    expect(b.time).toBe(500)
    mode = 'ordinal'
    expect(b.time).toBeNull()
    scarf.publish(null)
  })

  it('re-reads the published time live, so a pan moves the mark', () => {
    let ms = 500
    const scarf = timeCursorPort(6, () => 7)
    scarf.publish(() => ms)
    expect(b.time).toBe(500)
    ms = 1800
    expect(b.time).toBe(1800)
    scarf.publish(null)
  })
})

describe('time cursor projection', () => {
  it('maps a time to a pixel-centre-aligned x across the band', () => {
    expect(timeCursorX(BAND, TIMELINE, 0)).toBe(100.5)
    expect(timeCursorX(BAND, TIMELINE, 500)).toBe(300.5)
    expect(timeCursorX(BAND, TIMELINE, 1000)).toBe(500.5)
  })

  it('inverts timeAtX (before the pixel-centre alignment)', () => {
    expect(timeAtX(BAND, TIMELINE, 300)).toBe(500)
    expect(timeAtX(BAND, TIMELINE, 100)).toBe(0)
    const t = timeAtX(BAND, TIMELINE, 337)
    expect(timeCursorX(BAND, TIMELINE, t)).toBe(337.5)
  })

  it('carries the window offset in both directions', () => {
    expect(timeAtX(BAND, WINDOW, 300)).toBe(2000)
    expect(timeCursorX(BAND, WINDOW, timeAtX(BAND, WINDOW, 337))).toBe(337.5)
  })

  it('gives no pixel outside the visible window, so no plot ever clamps', () => {
    expect(timeCursorX(BAND, WINDOW, 999)).toBeNull()
    expect(timeCursorX(BAND, WINDOW, 3001)).toBeNull()
    expect(timeCursorX(BAND, WINDOW, 1000)).toBe(100.5)
  })

  it('gives no pixel for a degenerate window, a missing cursor or NaN', () => {
    expect(timeCursorX(BAND, { minValue: 5, maxValue: 5 }, 5)).toBeNull()
    expect(timeCursorX(BAND, TIMELINE, null)).toBeNull()
    expect(timeCursorX(BAND, TIMELINE, NaN)).toBeNull()
  })
})

describe('time cursor mark', () => {
  it('strokes one full-height guide clipped to the band', () => {
    const { points, clips, ctx } = recorder()
    drawTimeCursor(ctx, BAND, 300.5)
    expect(points).toEqual([300.5, 50, 300.5, 250])
    expect(clips).toEqual([100, 50, 400, 200])
  })

  it('is the shared dashed CROSSHAIR guide, not a bespoke stroke', () => {
    const { dashes, ctx } = recorder()
    drawTimeCursor(ctx, BAND, 300.5)
    expect(dashes).toEqual([[2, 2]])
    expect(ctx.strokeStyle).toBe(CROSSHAIR_COLOR)
  })

  it('draws nothing without a pixel', () => {
    const { points, ctx } = recorder()
    drawTimeCursor(ctx, BAND, null)
    expect(points).toEqual([])
  })
})

describe('scarf timeline-mode gate', () => {
  const settings = (timeline: ScarfPlotSettings['timeline']) =>
    ({ timeline, stimulusId: 7 }) as ScarfPlotSettings

  it('scopes an absolute scarf to its stimulus', () => {
    expect(absoluteTimeScope(settings('absolute'))).toBe(7)
  })

  it('refuses ordinal (a segment index) and relative (a percent)', () => {
    expect(absoluteTimeScope(settings('ordinal'))).toBeNull()
    expect(absoluteTimeScope(settings('relative'))).toBeNull()
  })
})

// Export safety: the export derivation never builds a screen recipe, so no port
// ever reaches an exported figure.
vi.mock('$lib/plots/registry', () => ({
  resolvePlotDefinition: () => ({
    view: { deriveView: () => ({ component: null, props: { data: 'view-only' } }) },
    screen: () => {
      throw new Error('the export path must never build a screen recipe')
    },
  }),
}))

describe('export inertness', () => {
  it('derives export views without ever constructing a screen recipe', async () => {
    const { deriveItemView } = await import(
      '$lib/modals/export/export-figures/view'
    )
    const item = { type: 'evolvingMetrics', settings: { stimulusId: 7 }, w: 12, h: 12 }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const view = deriveItemView({} as any, item as any)
    expect(view?.props).toEqual({ data: 'view-only' })
    expect(view?.props).not.toHaveProperty('timeCursor')
  })
})
