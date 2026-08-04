/**
 * PLOT CURSOR contract: both channels' scope/ownership algebra, the time
 * projection pair, the guide mark, the scarf's mode gate, and export inertness.
 * Not covered (node suite, nothing mounts): `usePlot`'s `overlayDeps` repaint and
 * the recipes' `onDestroy` retraction.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createPlotCursorPort,
  cursorRows,
  drawTimeGuides,
  strokeCrosshairPanel,
  timeAtX,
  timeGuideX,
  timeGuideXs,
} from '$lib/plots/shared/plotCursor.svelte'
import { absoluteTimeScope } from '$lib/plots/scarf/core/screen.svelte'
import {
  CROSSHAIR_COLOR,
  CROSSHAIR_DASH,
  markCrosshairNode,
  markCrosshairStrip,
  strokeCrosshairRect,
  strokeCrosshairRing,
} from '$lib/plots/shared/canvasUtils'
import {
  drawMatrixCrosshair,
  drawMatrixParticipantStrips,
  matrixCellParticipants,
} from '$lib/plots/shared/matrixRenderer'
import type { ScarfPlotSettings } from '$lib/plots/scarf/types'

const BAND = { x: 100, y: 50, width: 400, height: 200 }
const TIMELINE = { minValue: 0, maxValue: 1000 }
/** A panned window: pins the `minValue` offset both maps must carry. */
const WINDOW = { minValue: 1000, maxValue: 3000 }

/** Records what the marks batch: segments, arcs, bands, clip rects, dashes. */
function recorder() {
  const points: number[] = []
  const clips: number[] = []
  const dashes: number[][] = []
  const arcs: number[] = []
  const bands: number[] = []
  const fills: number[] = []
  const ctx = {
    save() {}, restore() {}, beginPath() {}, stroke() {},
    setLineDash(d: number[]) { dashes.push(d) },
    strokeStyle: '', fillStyle: '', lineWidth: 0, globalAlpha: 1,
    rect(x: number, y: number, w: number, h: number) { clips.push(x, y, w, h) },
    clip() {},
    fillRect(x: number, y: number, w: number, h: number) { bands.push(x, y, w, h) },
    fill() { fills.push(1) },
    arc(cx: number, cy: number, r: number) { arcs.push(cx, cy, r) },
    moveTo(x: number, y: number) { points.push(x, y) },
    lineTo(x: number, y: number) { points.push(x, y) },
  } as unknown as CanvasRenderingContext2D
  return { points, clips, dashes, arcs, bands, fills, ctx }
}

// Module singleton (one pointer exists) — retract between cases.
const a = createPlotCursorPort(1, () => 7)
const b = createPlotCursorPort(2, () => 7)
const otherStimulus = createPlotCursorPort(3, () => 9)
const notAbsolute = createPlotCursorPort(4, () => null)
afterEach(() => {
  a.publish(null)
  b.publish(null)
  otherStimulus.publish(null)
  notAbsolute.publish(null)
})

describe('times channel', () => {
  it('marks siblings on the same stimulus and never the publisher itself', () => {
    a.publish({ times: () => [500] })
    expect(b.times).toEqual([500])
    expect(a.times).toEqual([])
  })

  it('does not cross stimuli', () => {
    a.publish({ times: () => [500] })
    expect(otherStimulus.times).toEqual([])
  })

  it('treats 0 ms as a real position', () => {
    a.publish({ times: () => [0] })
    expect(b.times).toEqual([0])
  })

  it('neither publishes nor marks without a scope (ordinal / relative axes)', () => {
    notAbsolute.publish({ times: () => [500] })
    expect(b.times).toEqual([])
    // READING is gated too, which is the trap: a plot that only wants to RECEIVE a
    // time still has to declare a scope. Recurrence draws fixation indices, not ms,
    // and was silently deaf until its recipe passed one.
    a.publish({ times: () => [500] })
    expect(notAbsolute.times).toEqual([])
  })

  it('is absent when the publisher has no time axis', () => {
    a.publish({ participants: () => [12] })
    expect(b.times).toEqual([])
  })

  it('re-reads the publisher live, so losing its scope drops the mark', () => {
    // An undo switching a scarf to 'ordinal' under a resting pointer: no pointer
    // event fires, so a snapshot would strand the mark on every sibling.
    let mode: 'absolute' | 'ordinal' = 'absolute'
    const scarf = createPlotCursorPort(5, () => (mode === 'absolute' ? 7 : null))
    scarf.publish({ times: () => [500] })
    expect(b.times).toEqual([500])
    mode = 'ordinal'
    expect(b.times).toEqual([])
    scarf.publish(null)
  })

  it('re-reads the published time live, so a pan moves the mark', () => {
    let ms = 500
    const scarf = createPlotCursorPort(6, () => 7)
    scarf.publish({ times: () => [ms] })
    expect(b.times).toEqual([500])
    ms = 1800
    expect(b.times).toEqual([1800])
    scarf.publish(null)
  })
})

describe('participants channel', () => {
  it('marks the same participant ACROSS stimuli — deliberately unscoped', () => {
    // One person's row on another stimulus is the point of the channel; only the
    // time channel is stimulus-gated.
    a.publish({ times: () => [500], participants: () => [12] })
    expect(otherStimulus.participants).toEqual([12])
    expect(otherStimulus.times).toEqual([])
  })

  it('carries a PAIR, so a similarity cell marks both people', () => {
    a.publish({ participants: () => [12, 34] })
    expect(b.participants).toEqual([12, 34])
  })

  it('marks siblings but never the publisher itself', () => {
    a.publish({ participants: () => [12] })
    expect(b.participants).toEqual([12])
    expect(a.participants).toEqual([])
  })

  it('is empty when the publisher has no participant under the pointer', () => {
    a.publish({ times: () => [500] })
    expect(b.participants).toEqual([])
  })

  it('survives a publisher with no time scope (a matrix spanning stimuli)', () => {
    notAbsolute.publish({ participants: () => [12] })
    expect(b.participants).toEqual([12])
    expect(b.times).toEqual([])
  })

  it('re-reads the published set live', () => {
    let ids = [12]
    a.publish({ participants: () => ids })
    expect(b.participants).toEqual([12])
    ids = [34, 56]
    expect(b.participants).toEqual([34, 56])
  })

  it('retracts both channels at once, publisher-scoped', () => {
    a.publish({ times: () => [500], participants: () => [12] })
    b.publish(null)
    expect(b.times).toEqual([500])
    expect(b.participants).toEqual([12])
    a.publish(null)
    expect(b.times).toEqual([])
    expect(b.participants).toEqual([])
  })

  it('hands ownership to the last publisher', () => {
    a.publish({ participants: () => [12] })
    b.publish({ participants: () => [34] })
    expect(a.participants).toEqual([34])
    expect(b.participants).toEqual([])
  })

  it('reads a cursor-less empty set as one shared array, never a fresh one', () => {
    expect(b.participants).toBe(b.participants)
  })
})

describe('cursorRows', () => {
  const ids = [5, 12, 34]

  it('maps the cursor set onto this plot own row order, ascending', () => {
    expect(cursorRows(ids, [12])).toEqual([1])
    expect(cursorRows(ids, [34, 5])).toEqual([0, 2])
  })

  it('is empty for no cursor and for participants this plot does not show', () => {
    expect(cursorRows(ids, [])).toEqual([])
    expect(cursorRows(ids, [99])).toEqual([])
    expect(cursorRows([], [12])).toEqual([])
  })

  it('marks only the ones it has, when the cursor pair is half-known', () => {
    expect(cursorRows(ids, [12, 99])).toEqual([1])
  })
})

describe('time projection', () => {
  it('maps a time to a pixel-centre-aligned x across the band', () => {
    expect(timeGuideX(BAND, TIMELINE, 0)).toBe(100.5)
    expect(timeGuideX(BAND, TIMELINE, 500)).toBe(300.5)
    expect(timeGuideX(BAND, TIMELINE, 1000)).toBe(500.5)
  })

  it('inverts timeAtX (before the pixel-centre alignment)', () => {
    expect(timeAtX(BAND, TIMELINE, 300)).toBe(500)
    expect(timeAtX(BAND, TIMELINE, 100)).toBe(0)
    const t = timeAtX(BAND, TIMELINE, 337)
    expect(timeGuideX(BAND, TIMELINE, t)).toBe(337.5)
  })

  it('carries the window offset in both directions', () => {
    expect(timeAtX(BAND, WINDOW, 300)).toBe(2000)
    expect(timeGuideX(BAND, WINDOW, timeAtX(BAND, WINDOW, 337))).toBe(337.5)
  })

  it('gives no pixel outside the visible window, so no plot ever clamps', () => {
    expect(timeGuideX(BAND, WINDOW, 999)).toBeNull()
    expect(timeGuideX(BAND, WINDOW, 3001)).toBeNull()
    expect(timeGuideX(BAND, WINDOW, 1000)).toBe(100.5)
  })

  it('gives no pixel for a degenerate window, a missing cursor or NaN', () => {
    expect(timeGuideX(BAND, { minValue: 5, maxValue: 5 }, 5)).toBeNull()
    expect(timeGuideX(BAND, TIMELINE, null)).toBeNull()
    expect(timeGuideX(BAND, TIMELINE, NaN)).toBeNull()
  })
})

describe('time guide mark', () => {
  it('strokes one full-height guide per instant, clipped to the band', () => {
    const { points, clips, ctx } = recorder()
    drawTimeGuides(ctx, BAND, [300.5])
    expect(points).toEqual([300.5, 50, 300.5, 250])
    expect(clips).toEqual([100, 50, 400, 200])
  })

  it('strokes BOTH moments of a recurrence pair in one batch', () => {
    const { points, dashes, ctx } = recorder()
    drawTimeGuides(ctx, BAND, [180.5, 420.5])
    expect(points).toEqual([180.5, 50, 180.5, 250, 420.5, 50, 420.5, 250])
    // One dash setup for the batch: the guides cannot drift apart in style.
    expect(dashes).toEqual([CROSSHAIR_DASH])
  })

  it('is the shared dashed CROSSHAIR guide, not a bespoke stroke', () => {
    const { dashes, ctx } = recorder()
    drawTimeGuides(ctx, BAND, [300.5])
    expect(dashes).toEqual([CROSSHAIR_DASH])
    expect(ctx.strokeStyle).toBe(CROSSHAIR_COLOR)
  })

  it('draws nothing for an empty set', () => {
    const { points, clips, ctx } = recorder()
    drawTimeGuides(ctx, BAND, [])
    expect(points).toEqual([])
    expect(clips).toEqual([])
  })

  it('maps a set of instants, dropping the ones outside the window', () => {
    // A recurrence pair whose second moment the receiving plot has panned past.
    expect(timeGuideXs(BAND, WINDOW, [1000, 2000, 4000])).toEqual([100.5, 300.5])
    expect(timeGuideXs(BAND, WINDOW, [])).toEqual([])
  })
})

// PARITY: nothing in a mark encodes WHO designated it. A plot's own CROSSHAIR and
// the PLOT CURSOR draw the IDENTICAL strip mark; only their extent differs. Shapes
// with no local mark at all (a node, a SPLOM dot, a whole panel) use the dashed
// outline forms, which are then the only mark those shapes have.
describe('mark parity', () => {
  it('marks a strip with a band plus its two LONG edges dashed', () => {
    const row = recorder()
    markCrosshairStrip(row.ctx, 100, 50, 400, 20, 0.2, 'x')
    expect(row.bands).toEqual([100, 50, 400, 20])
    expect(row.points).toEqual([100, 50.5, 500, 50.5, 100, 70.5, 500, 70.5])
    expect(row.dashes).toEqual([CROSSHAIR_DASH])
    expect(row.ctx.strokeStyle).toBe(CROSSHAIR_COLOR)

    const col = recorder()
    markCrosshairStrip(col.ctx, 100, 50, 20, 400, 0.2, 'y')
    expect(col.points).toEqual([100.5, 50, 100.5, 450, 120.5, 50, 120.5, 450])
  })

  it('gives the local crosshair and the cursor the identical strip', () => {
    // THE parity pin: a matrix cursor marking row 1 must be byte-identical to the
    // row half of the local crosshair over any cell in row 1.
    const geom = { xOffset: 10, yOffset: 20, cellSize: 30, gridWidth: 90, gridHeight: 60 }
    const cursor = recorder()
    drawMatrixParticipantStrips(cursor.ctx, geom, { rows: [1], cols: [] })
    const local = recorder()
    drawMatrixCrosshair(local.ctx, geom, { row: 1, col: 2 })
    // The local mark is its column strip followed by the SAME row strip.
    expect(local.points.slice(8)).toEqual(cursor.points)
    expect(local.dashes).toEqual([CROSSHAIR_DASH, CROSSHAIR_DASH])
  })

  it('closes the outline only where the region is not a strip', () => {
    const { points, dashes, ctx } = recorder()
    strokeCrosshairRect(ctx, 100, 50, 400, 20)
    // Co-directional edges, not a perimeter walk: canvas restarts the dash phase
    // per subpath, so two abutting outlines must not oppose each other.
    expect(points).toEqual([
      100.5, 50.5, 500.5, 50.5,
      100.5, 70.5, 500.5, 70.5,
      100.5, 50.5, 100.5, 70.5,
      500.5, 50.5, 500.5, 70.5,
    ])
    expect(dashes).toEqual([CROSSHAIR_DASH])
    expect(ctx.strokeStyle).toBe(CROSSHAIR_COLOR)
  })

  it('drops only the halo for the weaker "adjacent" tier', () => {
    // A graph's neighbour ring: same colour, same dash, same radius, NO fill — so
    // "adjacent to the designated node" cannot be misread as designated.
    const { arcs, dashes, fills, ctx } = recorder()
    strokeCrosshairRing(ctx, 40, 60, 8)
    expect(arcs).toEqual([40, 60, 8])
    expect(fills).toHaveLength(0)
    expect(dashes).toEqual([CROSSHAIR_DASH])
    expect(ctx.strokeStyle).toBe(CROSSHAIR_COLOR)
  })

  it('marks a point with a halo plus its dashed ring, one arc for both', () => {
    // The strip mark's sibling for a round thing (a scangraph node, a SPLOM dot):
    // a 1px dashed ring alone is not enough to find, so it is filled too.
    const { arcs, dashes, fills, ctx } = recorder()
    markCrosshairNode(ctx, 40, 60, 8)
    expect(arcs).toEqual([40, 60, 8])
    expect(fills).toHaveLength(1)
    expect(dashes).toEqual([CROSSHAIR_DASH])
    expect(ctx.strokeStyle).toBe(CROSSHAIR_COLOR)
    expect(ctx.fillStyle).toBe(CROSSHAIR_COLOR)
  })

  it('insets a whole-panel outline so it cannot repaint the axis frame', () => {
    // scanpath / recurrence: the panel IS one participant. `drawPlotArea` strokes
    // exactly the frame and the overlay runs after the chrome, so the inset is
    // load-bearing — and owned by the helper, not recomputed per figure.
    const frame = { x: 40, y: 20, width: 200, height: 100 }
    const { points, dashes, ctx } = recorder()
    strokeCrosshairPanel(ctx, frame)
    const xs = points.filter((_, i) => i % 2 === 0)
    const ys = points.filter((_, i) => i % 2 === 1)
    // Strictly inside the frame on all four sides, so the chrome border survives.
    expect(Math.min(...xs)).toBeGreaterThan(frame.x)
    expect(Math.max(...xs)).toBeLessThan(frame.x + frame.width)
    expect(Math.min(...ys)).toBeGreaterThan(frame.y)
    expect(Math.max(...ys)).toBeLessThan(frame.y + frame.height)
    expect(dashes).toEqual([CROSSHAIR_DASH])
    expect(ctx.strokeStyle).toBe(CROSSHAIR_COLOR)
  })

  it('marks every strip the cursor set occupies, on either axis', () => {
    const geom = { xOffset: 10, yOffset: 20, cellSize: 30, gridWidth: 90, gridHeight: 60 }
    // 8 numbers = 2 segments = one strip's long edges.
    const rowOnly = recorder()
    drawMatrixParticipantStrips(rowOnly.ctx, geom, { rows: [1], cols: [] })
    // Geometry, not just arity: a row strip is full grid WIDTH, one cell tall, at
    // the row's y — so a row/col or cellSize/gridHeight swap cannot pass.
    expect(rowOnly.points).toEqual([10, 50.5, 100, 50.5, 10, 80.5, 100, 80.5])

    // A PAIR on a participant x participant matrix: two rows and two columns.
    const pair = recorder()
    drawMatrixParticipantStrips(pair.ctx, geom, { rows: [0, 2], cols: [0, 2] })
    expect(pair.points).toHaveLength(32)
    // Third strip = the first COLUMN: one cell wide, full grid height.
    expect(pair.points.slice(16, 24)).toEqual([10.5, 20, 10.5, 80, 40.5, 20, 40.5, 80])

    const neither = recorder()
    drawMatrixParticipantStrips(neither.ctx, geom, { rows: [], cols: [] })
    expect(neither.points).toEqual([])
  })

  it('composes a cell into the participants it designates', () => {
    const rows = [11, 22, 33]
    // A participant x participant cell is a PAIR, sorted because it is a set.
    expect(matrixCellParticipants(rows, rows, { row: 2, col: 0 })).toEqual([11, 33])
    expect(matrixCellParticipants(rows, rows, { row: 0, col: 2 })).toEqual([11, 33])
    // The diagonal is one person, not a phantom pair.
    expect(matrixCellParticipants(rows, rows, { row: 1, col: 1 })).toEqual([22])
    // A stimulus / AOI / metric axis contributes nothing.
    expect(matrixCellParticipants(rows, undefined, { row: 1, col: 5 })).toEqual([22])
    expect(matrixCellParticipants(undefined, undefined, { row: 1, col: 5 })).toEqual([])
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
    expect(view?.props).not.toHaveProperty('plotCursor')
  })
})
