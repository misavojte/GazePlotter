/**
 * Where a windowed value may be PAINTED, for one participant's series. Pure —
 * no engine — so every gap and edge case is unit-testable; the fabrications
 * this file exists to prevent were invisible from the transformer.
 *
 * Both branches answer one question: over which ms is this value a supportable
 * statement? Cells are sorted and DISJOINT within a participant, which
 * `findWindowAt`'s binary search and the overlay's pointer walk both require.
 */
import type { EvolvingMetricsWindow } from '../types'

/**
 * Paired `(starts[], ends[])` from per-window centres: each window owns from
 * halfway back to the previous surviving centre to halfway forward to the next.
 * First and last use symmetric half-gap extrapolation. `NaN` centres (dropped
 * windows) are skipped, so they don't break Voronoi for their neighbours.
 *
 * A side with no surviving neighbour at all stays UNBOUNDED — the caller clips to
 * the window, so unbounded just means "the window's own edge".
 */
function voronoiBoundaries(centers: Float64Array): {
  starts: Float64Array
  ends: Float64Array
} {
  const N = centers.length
  const starts = new Float64Array(N).fill(-Infinity)
  const ends = new Float64Array(N).fill(Infinity)

  const validIdx: number[] = []
  for (let i = 0; i < N; i++) if (Number.isFinite(centers[i])) validIdx.push(i)

  for (let k = 0; k < validIdx.length; k++) {
    const i = validIdx[k]
    const c = centers[i]
    const hasPrev = k > 0
    const hasNext = k < validIdx.length - 1
    if (hasPrev && hasNext) {
      starts[i] = (centers[validIdx[k - 1]] + c) / 2
      ends[i] = (c + centers[validIdx[k + 1]]) / 2
    } else if (hasNext) {
      const half = (centers[validIdx[k + 1]] - c) / 2
      starts[i] = c - half
      ends[i] = c + half
    } else if (hasPrev) {
      const half = (c - centers[validIdx[k - 1]]) / 2
      starts[i] = c - half
      ends[i] = c + half
    }
  }
  return { starts, ends }
}

/**
 * Time-windowed spans. Paint never leaves the window, and is narrowed further by
 * the nearest DROPPED window on each side — a drop proves the metric measured
 * nothing in its span, so no surviving value's data lies inside it. Without that
 * narrowing a value reaches up to `windowSize` back over ground the metric never
 * saw (colour before the fixation that produced it), and a run truncated by the
 * recording's start paints its whole window as one block.
 *
 * The narrowing is internal to the clip: `windowStartMs`/`windowEndMs` stay the
 * WINDOW, so the hover band is the same width everywhere. Dense series and epoch
 * (`step === windowSize`) are byte-identical to the pre-narrowing behaviour. With
 * `step > windowSize` a cell is now its own window instead of a step-wide slice
 * spilling outside it, so the unmeasured time between windows stays unpainted.
 *
 * EVERY surviving window gets a cell. Dropping one would hide a measurement no
 * other window made, and would take it out of the colour scale too.
 *
 * KNOWN LOOSENESS: the narrowing can only bound against DROPPED windows, and at the
 * recording's first or last window there is none on that side. A run crowded against
 * either end therefore fills a span up to one window wide, which is the honest
 * extent of what the values prove, not a claim that gaze covered all of it.
 */
export function timeWindowSpans(
  timeline: ArrayLike<number>,
  values: ArrayLike<number>,
  windowSize: number,
): EvolvingMetricsWindow[] {
  const N = values.length
  const half = windowSize / 2
  const centers = new Float64Array(N).fill(NaN)
  for (let i = 0; i < N; i++) {
    if (Number.isFinite(values[i])) centers[i] = timeline[i] + half
  }
  const { starts, ends } = voronoiBoundaries(centers)

  /** Start of the next dropped window per index — nothing after it was measured. */
  const notAfter = new Float64Array(N)
  let latest = Infinity
  for (let i = N - 1; i >= 0; i--) {
    if (!Number.isFinite(centers[i])) latest = timeline[i]
    notAfter[i] = latest
  }

  const out: EvolvingMetricsWindow[] = []
  const push = (k: number, startMs: number, endMs: number) => {
    const c = centers[k]
    out.push({
      startMs, endMs, centerMs: c, value: values[k],
      windowStartMs: c - half, windowEndMs: c + half,
    })
  }

  // A RUN of consecutive surviving windows is resolved together. Per-cell
  // resolution starved later windows: an early cell claimed ground, the next
  // several fell behind it and were dropped, and a measurement no other window
  // could make disappeared from the plot AND from the colour scale.
  let notBefore = -Infinity
  let i = 0
  while (i < N) {
    if (!Number.isFinite(centers[i])) {
      notBefore = timeline[i] + windowSize
      i++
      continue
    }
    let j = i
    while (j + 1 < N && Number.isFinite(centers[j + 1])) j++

    // Every value in the run describes data inside this span: the run's windows,
    // narrowed by the fixation-free windows on either side.
    const roomStart = Math.max(timeline[i], notBefore)
    const roomEnd = Math.min(timeline[j] + windowSize, notAfter[j])

    // Each cell is its Voronoi share clipped to its own window, which is what makes
    // a dense series tile at the step, epoch tile at the window, and `step >
    // windowSize` leave the unmeasured time between windows unpainted.
    let fits = roomEnd > roomStart
    for (let k = i; k <= j && fits; k++) {
      const a = Math.max(starts[k], centers[k] - half)
      const b = Math.min(ends[k], centers[k] + half)
      if (!(b > a) || a < roomStart || b > roomEnd) fits = false
    }

    if (fits) {
      for (let k = i; k <= j; k++) {
        push(k, Math.max(starts[k], centers[k] - half), Math.min(ends[k], centers[k] + half))
      }
    } else if (roomEnd > roomStart) {
      // Crowded: the run's windows overlap ground much narrower than the grid they
      // sit on, because the recording's edge or a gap truncated it. Share the room
      // in order instead of letting the first cells take it — every measurement
      // stays visible, in sequence, inside the span its data occupies.
      const width = (roomEnd - roomStart) / (j - i + 1)
      for (let k = i; k <= j; k++) {
        push(k, roomStart + (k - i) * width, roomStart + (k - i + 1) * width)
      }
    }
    i = j + 1
  }
  return out
}

/**
 * Fixation-windowed spans: sample-and-hold from the middle fixation's onset.
 * `timeline` holds window starts as fixation indices into `timestamps` /
 * `endTimestamps`; `stepFix` is the EMITTED step (already strided).
 *
 * The leading `midOffset` fixations have no anchor and stay unpainted.
 */
export function fixationWindowSpans(
  timeline: ArrayLike<number>,
  values: ArrayLike<number>,
  timestamps: ArrayLike<number>,
  endTimestamps: ArrayLike<number>,
  windowSize: number,
  stepFix: number,
  midOffset: number,
): EvolvingMetricsWindow[] {
  const N = values.length
  const totalFix = timestamps.length
  const samples: {
    midFix: number
    centerMs: number
    value: number
    windowStartMs: number
    windowEndMs: number
  }[] = []
  for (let i = 0; i < N; i++) {
    const v = values[i]
    if (!Number.isFinite(v)) continue
    const midFix = timeline[i] + midOffset
    if (midFix >= totalFix) continue
    const a = timestamps[midFix]
    const b = endTimestamps[midFix]
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) continue
    samples.push({
      midFix,
      centerMs: (a + b) / 2,
      value: v,
      windowStartMs: timestamps[timeline[i]],
      windowEndMs: endTimestamps[Math.min(totalFix - 1, timeline[i] + windowSize - 1)],
    })
  }

  const out: EvolvingMetricsWindow[] = []
  for (let k = 0; k < samples.length; k++) {
    const s = samples[k]
    const startMs = timestamps[s.midFix]
    // Runs to the next EMITTED window, never the next SURVIVING one: a dropped
    // window (RQA reports NaN where no recurrent line exists) would otherwise get
    // this value painted across its span. Never past the fixations the window
    // itself saw, which is what bites once `stepFix` approaches `windowSize`.
    const next = samples[k + 1]
    const nextMid = s.midFix + stepFix
    const endMs = Math.min(
      next !== undefined && next.midFix - s.midFix <= stepFix
        ? timestamps[next.midFix]
        : nextMid < totalFix
          ? timestamps[nextMid]
          : endTimestamps[s.midFix],
      s.windowEndMs,
    )
    if (!Number.isFinite(endMs) || endMs <= startMs) continue
    out.push({
      startMs,
      endMs,
      centerMs: s.centerMs,
      value: s.value,
      windowStartMs: s.windowStartMs,
      windowEndMs: s.windowEndMs,
    })
  }
  return out
}
