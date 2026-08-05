/**
 * PAINT SPANS for the Metric Timeline. The load-bearing property is the same one
 * the recurrence cursor has: REFUSAL. A window the metric could not measure stays
 * unpainted, and no value is drawn over time its data provably cannot occupy —
 * colour before the fixation that produced it is a fabricated observation.
 *
 * These live here and not against the transformer because the transformer needs a
 * live DataEngine, which is exactly how a span that reached 9 s over an empty
 * recording stayed invisible.
 */
import { describe, expect, it } from 'vitest'
import {
  fixationWindowSpans,
  timeWindowSpans,
} from '$lib/plots/evolving-metrics/core/windowSpans'
import type { EvolvingMetricsWindow } from '$lib/plots/evolving-metrics/types'

type Fixation = [start: number, end: number]

/**
 * The series a mean-duration metric emits: ANY fixation overlapping the window
 * contributes its full duration (`fixationDuration.onFixation`), and a window no
 * fixation touches is NaN — dropped, not zero. Mirror of the metric's own rule;
 * pinned against the real runtime by tests/runtimeWindowedAoiVector.test.ts.
 */
function meanDurationSeries(
  fixations: Fixation[],
  windowSize: number,
  stepSize: number,
  extentMs: number
) {
  const timeline: number[] = []
  const values: number[] = []
  for (let t = 0; t + windowSize <= extentMs; t += stepSize) {
    let sum = 0
    let n = 0
    for (const [s, e] of fixations) {
      if (s < t + windowSize && e > t) {
        sum += e - s
        n++
      }
    }
    timeline.push(t)
    values.push(n === 0 ? NaN : sum / n)
  }
  return { timeline, values }
}

const widths = (ws: EvolvingMetricsWindow[]) => ws.map(w => w.endMs - w.startMs)
const paint = (ws: EvolvingMetricsWindow[]) => ws.map(w => [w.startMs, w.endMs])

/** Overlap with a half-open interval, used to assert nothing is painted in a desert. */
function overlaps(w: EvolvingMetricsWindow, from: number, to: number): boolean {
  return w.startMs < to && w.endMs > from
}

function expectSortedDisjoint(ws: EvolvingMetricsWindow[]) {
  for (let i = 1; i < ws.length; i++) {
    // findWindowAt binary-searches these and the overlay walks them with one
    // pointer; either breaks silently on an overlap.
    expect(ws[i].startMs).toBeGreaterThanOrEqual(ws[i - 1].endMs)
  }
}

function expectInsideWindow(ws: EvolvingMetricsWindow[]) {
  for (const w of ws) {
    expect(w.startMs).toBeGreaterThanOrEqual(w.windowStartMs)
    expect(w.endMs).toBeLessThanOrEqual(w.windowEndMs)
  }
}

/** The hover band. Uniform for a time-windowed metric — the window IS the window. */
const windowWidths = (ws: EvolvingMetricsWindow[]) =>
  ws.map(w => w.windowEndMs - w.windowStartMs)

/**
 * THE property: colour only where the participant actually fixated. Every painted
 * span must touch a real fixation — and conversely a window a fixation touches is
 * never dropped, which is what `fixationDuration`'s any-overlap membership buys.
 */
function expectPaintTouchesAFixation(
  ws: EvolvingMetricsWindow[],
  fixations: Fixation[]
) {
  for (const w of ws) {
    expect(
      fixations.some(([s, e]) => s < w.endMs && e > w.startMs),
      `painted ${w.startMs}–${w.endMs} with no fixation under it`
    ).toBe(true)
  }
}

describe('timeWindowSpans — healthy series are untouched', () => {
  it('tiles a dense sliding series at the step, centred on each anchor', () => {
    // 1000 ms window / 100 ms step over back-to-back fixations.
    const fixations: Fixation[] = Array.from({ length: 40 }, (_, i) => [i * 300, i * 300 + 250])
    const { timeline, values } = meanDurationSeries(fixations, 1000, 100, 12000)
    const spans = timeWindowSpans(timeline, values, 1000)

    expect(spans.length).toBe(timeline.length)
    expect(new Set(widths(spans))).toEqual(new Set([100]))
    for (const w of spans) expect((w.startMs + w.endMs) / 2).toBeCloseTo(w.centerMs, 9)
    expectSortedDisjoint(spans)
    expectInsideWindow(spans)
  })

  it('paints epoch windows as themselves when step equals the window', () => {
    const fixations: Fixation[] = Array.from({ length: 20 }, (_, i) => [i * 200, i * 200 + 150])
    const { timeline, values } = meanDurationSeries(fixations, 1000, 1000, 4000)
    const spans = timeWindowSpans(timeline, values, 1000)

    expect(paint(spans)).toEqual([
      [0, 1000],
      [1000, 2000],
      [2000, 3000],
      [3000, 4000],
    ])
  })

  it('leaves the unmeasured time between windows unpainted when the step exceeds the window', () => {
    const fixations: Fixation[] = Array.from({ length: 30 }, (_, i) => [i * 100, i * 100 + 80])
    const { timeline, values } = meanDurationSeries(fixations, 500, 1000, 3000)
    const spans = timeWindowSpans(timeline, values, 500)

    // Stripes, not a smear: nothing was measured in [500,1000), so nothing claims it.
    expect(paint(spans)).toEqual([
      [0, 500],
      [1000, 1500],
      [2000, 2500],
    ])
    expectSortedDisjoint(spans)
  })
})

describe('timeWindowSpans — a dropped window bounds its neighbours', () => {
  it('does not paint a value across a long recording gap', () => {
    // The reported case: one short fixation at the start, then nothing for 10 s,
    // then a burst. The burst's value used to be painted from ~5.1 s — entirely
    // BEFORE the fixations that produced it — because a Voronoi boundary reaches
    // halfway to the next SURVIVING centre.
    const burst: Fixation[] = Array.from({ length: 8 }, (_, i) => [10000 + i * 250, 10200 + i * 250])
    const fixations: Fixation[] = [[0, 180], ...burst]
    const { timeline, values } = meanDurationSeries(fixations, 1000, 100, 11950)
    const spans = timeWindowSpans(timeline, values, 1000)

    for (const w of spans) expect(overlaps(w, 200, 10000)).toBe(false)
    expect(spans.some(w => overlaps(w, 0, 180))).toBe(true)
    // No block: the leading island paints the span its data provably occupies
    // (its window cut short by the first fixation-free window, [0,200]), where it
    // used to paint the whole 1000 ms window starting at t=0.
    expect(Math.max(...widths(spans))).toBeLessThan(1000)
    expectPaintTouchesAFixation(spans, fixations)
    expectSortedDisjoint(spans)
    expectInsideWindow(spans)
  })

  it('places an isolated fixation on the span its data provably occupies, not on the window centre', () => {
    // One 180 ms fixation at 3000 with deserts either side. Every window it
    // touches is finite, and each fixation-free window on either side proves the
    // fixation is not in ITS span: the last drop before ends at 3000 and the
    // first drop after starts at 3200, so the data is provably in [3000,3200].
    // Paint lands there — never on the window centres, which run 2600..3600.
    const { timeline, values } = meanDurationSeries([[3000, 3180]], 1000, 100, 12000)
    const spans = timeWindowSpans(timeline, values, 1000)

    // 11 windows see this fixation, so 11 cells share [3000,3200]: the fixation's
    // own bracket, not the 2600..3600 the window centres sit on. All carry the same
    // value, so the picture is one block of 180 exactly over the fixation.
    expect(spans.length).toBe(values.filter(Number.isFinite).length)
    expect(spans[0].startMs).toBe(3000)
    expect(spans[spans.length - 1].endMs).toBe(3200)
    for (let k = 1; k < spans.length; k++) expect(spans[k].startMs).toBe(spans[k - 1].endMs)
    expect(spans.every(w => w.value === 180)).toBe(true)
    expectInsideWindow(spans)
  })

  it('keeps every island when several are separated by deserts', () => {
    const fixations: Fixation[] = [[0, 180], [5000, 5200], [11000, 11300]]
    const { timeline, values } = meanDurationSeries(fixations, 1000, 100, 12000)
    const spans = timeWindowSpans(timeline, values, 1000)

    for (const [s, e] of fixations) {
      expect(spans.some(w => overlaps(w, s, e))).toBe(true)
    }
    expectSortedDisjoint(spans)
    expectInsideWindow(spans)
  })

  it('still paints a short dropout it cannot bound away', () => {
    // A gap shorter than the window is genuinely inside some window's reach, so the
    // bound cannot exclude it — the value there is the only measurement covering it.
    const fixations: Fixation[] = [
      ...Array.from({ length: 5 }, (_, i): Fixation => [i * 200, i * 200 + 150]),
      ...Array.from({ length: 5 }, (_, i): Fixation => [1400 + i * 200, 1550 + i * 200]),
    ]
    const { timeline, values } = meanDurationSeries(fixations, 1000, 100, 4000)
    const spans = timeWindowSpans(timeline, values, 1000)

    expect(spans.some(w => overlaps(w, 900, 1400))).toBe(true)
    expectInsideWindow(spans)
  })

  it('keeps the window band the same width everywhere, including after tracking loss', () => {
    // Reported case: a long tracking loss, then a few fixations at the very end.
    // The band used to run from the fixation to the RIGHT EDGE, because the
    // narrowing moved its left edge while nothing bounded its right — one field
    // doing two jobs. The band is the window now; only the paint is narrowed.
    const tail: Fixation[] = Array.from({ length: 3 }, (_, i) => [11000 + i * 250, 11200 + i * 250])
    const fixations: Fixation[] = [[100, 260], ...tail]
    const { timeline, values } = meanDurationSeries(fixations, 1000, 100, 12000)
    const spans = timeWindowSpans(timeline, values, 1000)

    expect(new Set(windowWidths(spans))).toEqual(new Set([1000]))
    for (const w of spans) expect((w.windowStartMs + w.windowEndMs) / 2).toBeCloseTo(w.centerMs, 9)
    for (const w of spans) expect(overlaps(w, 300, 11000)).toBe(false)
    // NOT expectPaintTouchesAFixation here: at the recording's START there is no
    // earlier dropped window to bound against, so the leading run's provable span
    // reaches back to t=0 and its cells fill it. The bound is honest but loose on
    // that side, by up to one window. See the note in windowSpans.ts.
    expectSortedDisjoint(spans)
    expectInsideWindow(spans)
  })

  it('leaves no hole around a lone fixation, however it straddles the window grid', () => {
    // The reported case: a sparse participant with one fixation. Every window it
    // touches has a value (any-overlap membership), and the paint over it is
    // contiguous — no gap inside the region a fixation is present for.
    const { timeline, values } = meanDurationSeries([[5000, 5400]], 1000, 100, 12000)
    const spans = timeWindowSpans(timeline, values, 1000)

    expect(spans.length).toBeGreaterThan(0)
    for (let i = 1; i < spans.length; i++) expect(spans[i].startMs).toBe(spans[i - 1].endMs)
    expect(spans[0].startMs).toBeLessThanOrEqual(5000)
    expect(spans[spans.length - 1].endMs).toBeGreaterThanOrEqual(5400)
    expectPaintTouchesAFixation(spans, [[5000, 5400]])
    expectInsideWindow(spans)
  })

  it('never discards a surviving window, so no measurement and no extreme is hidden', () => {
    // Every finite window is a measurement no other window made. Losing one hides it
    // from the cells, the tooltip AND the colour scale, which is derived from the
    // spans. An earlier per-cell rule silently dropped ~22% of them by letting the
    // first cells claim the ground and starving the rest.
    const cases: Fixation[][] = [
      [[3000, 4000]],
      [[5000, 5400]],
      [[200, 1100], [1400, 1500], [2600, 3500], [3700, 4400]],
      [[100, 260], [11000, 11200]],
      [[0, 180], [10000, 10200], [10500, 10700]],
    ]
    for (const fixations of cases) {
      const { timeline, values } = meanDurationSeries(fixations, 1000, 100, 12000)
      const finite = values.filter(v => Number.isFinite(v)).length
      const spans = timeWindowSpans(timeline, values, 1000)

      expect(spans.length, JSON.stringify(fixations)).toBe(finite)
      // ...and the extremes therefore survive into the legend.
      const painted = spans.map(w => w.value)
      const measured = values.filter(v => Number.isFinite(v))
      expect(Math.min(...painted)).toBe(Math.min(...measured))
      expect(Math.max(...painted)).toBe(Math.max(...measured))
      expectSortedDisjoint(spans)
      expectInsideWindow(spans)
    }
  })

  it('keeps a monotone measurement monotone across a crowded edge', () => {
    // One fixation late in the recording: 19 windows see it, all describing the same
    // 1000 ms of data. Their values ramp up and back down, and the ramp must reach
    // the plot unbroken — the per-cell rule cut it from 19 cells to 11 and left a
    // 40 → 90 jump in the middle of a strictly monotone series.
    const { timeline, values } = meanDurationSeries([[3000, 4000]], 1000, 100, 6000)
    const spans = timeWindowSpans(timeline, values, 1000)

    expect(spans.length).toBe(values.filter(Number.isFinite).length)
    for (let k = 1; k < spans.length; k++) expect(spans[k].startMs).toBe(spans[k - 1].endMs)
    expect(spans[0].startMs).toBe(3000)
    expect(spans[spans.length - 1].endMs).toBe(4000)
  })

  it('drops a series with no measurement at all rather than inventing one', () => {
    const spans = timeWindowSpans([0, 100, 200], [NaN, NaN, NaN], 1000)
    expect(spans).toEqual([])
  })
})

describe('fixationWindowSpans', () => {
  /** `n` fixations, 150 ms each with a 50 ms saccade between. */
  function contiguous(n: number, from = 0) {
    const timestamps: number[] = []
    const endTimestamps: number[] = []
    for (let i = 0; i < n; i++) {
      timestamps.push(from + i * 200)
      endTimestamps.push(from + i * 200 + 150)
    }
    return { timestamps, endTimestamps }
  }

  it('touches consecutive cells at step 1, so the overlay line stays connected', () => {
    const { timestamps, endTimestamps } = contiguous(10)
    // Window of 4 fixations, step 1: starts 0..6, anchor = start + 2.
    const timeline = [0, 1, 2, 3, 4, 5, 6]
    const values = timeline.map(() => 50)
    const spans = fixationWindowSpans(timeline, values, timestamps, endTimestamps, 4, 1, 2)

    expect(spans.length).toBe(7)
    for (let i = 1; i < spans.length; i++) expect(spans[i].startMs).toBe(spans[i - 1].endMs)
    // The leading floor(4/2) = 2 fixations have no anchor and stay unpainted.
    expect(spans[0].startMs).toBe(timestamps[2])
    expectInsideWindow(spans)
  })

  it('leaves a dropped window unpainted instead of holding the previous value', () => {
    const { timestamps, endTimestamps } = contiguous(10)
    const timeline = [0, 1, 2, 3, 4, 5, 6]
    // RQA reports NaN where no recurrent line exists — windows 3 and 4 are dropped.
    const values = [50, 50, 50, NaN, NaN, 50, 50]
    const spans = fixationWindowSpans(timeline, values, timestamps, endTimestamps, 4, 1, 2)

    expect(spans.length).toBe(5)
    // The cell before the drop stops one step forward, not at the next survivor.
    expect(spans[2].endMs).toBe(timestamps[5])
    expect(spans[3].startMs).toBe(timestamps[7])
    expectSortedDisjoint(spans)
    expectInsideWindow(spans)
  })

  it('never paints past the fixations its own window saw', () => {
    const { timestamps, endTimestamps } = contiguous(20)
    // Window 4 / step 4: the cell would run 4 fixations forward from the anchor,
    // which overshoots the window's last fixation by half a window.
    const timeline = [0, 4, 8, 12, 16]
    const values = timeline.map(() => 50)
    const spans = fixationWindowSpans(timeline, values, timestamps, endTimestamps, 4, 4, 2)

    expectInsideWindow(spans)
    expect(spans[0].endMs).toBe(endTimestamps[3])
    expectSortedDisjoint(spans)
  })

  it('ends the last cell on real data, never past the recording', () => {
    const { timestamps, endTimestamps } = contiguous(6)
    const timeline = [0, 1, 2]
    const spans = fixationWindowSpans(timeline, [50, 50, 50], timestamps, endTimestamps, 4, 1, 2)

    const last = spans[spans.length - 1]
    expect(last.endMs).toBeLessThanOrEqual(endTimestamps[5])
    expectInsideWindow(spans)
  })

  it('drops anchors past the end of the sequence', () => {
    const { timestamps, endTimestamps } = contiguous(3)
    // Anchor 0+2 exists; 4+2 does not.
    const spans = fixationWindowSpans([0, 4], [50, 50], timestamps, endTimestamps, 4, 1, 2)
    expect(spans.length).toBe(1)
  })
})
