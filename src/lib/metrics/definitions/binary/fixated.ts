import { defineMetric } from '../../core/defineMetric'
import { integerParam, numberParam } from '../../core/params'

/**
 * ## Was fixated (AOI hit / noticed rate)
 *
 * Binary per participant: 1 if the participant fixated the AOI (meeting the
 * threshold), else 0. Aggregated across participants as a `proportion`, this is
 * the per-AOI noticed-rate / hit ratio — the fraction of participants who looked
 * at the AOI at all. The `proportion` aggregation is the single signal that tells
 * the bar plot to render a plain proportional bar instead of a beeswarm of 0/1 dots.
 *
 * - **Shape:** `aoi-vector`
 * - **Unit:** `%` (the cross-participant aggregate is a proportion in [0,1])
 * - **Category:** `binary` (dichotomous detection — whether, not how many; the
 *   companion to time-to-first-fixation's "when")
 * - **Windowing:** not supported (presence is a recording-lifetime concept)
 *
 * ### Parameters
 * - `minFixationCount` (default 1): minimum fixations on the AOI to count as fixated.
 * - `minDwellMs` (default 0): minimum total dwell (ms) on the AOI to count as fixated.
 *
 * ### Invariants
 * - An AOI the participant never fixated emits a finite `0`, never NaN, so it stays
 *   in the proportion's denominator — otherwise the rate inflates toward 1.0.
 * - Binarised per AOI: 5 fixations still contribute 1, not 5 — this is a presence,
 *   not a count.
 */
const minFixationCount = integerParam('minFixationCount', 'Min fixations', 1, {
  min: 1,
  description: 'Minimum number of fixations on the AOI for it to count as fixated.',
})
const minDwellMs = numberParam('minDwellMs', 'Min dwell', 0, {
  min: 0,
  unit: 'ms',
  description: 'Minimum total dwell time (ms) on the AOI for it to count as fixated.',
})

defineMetric({
  id: 'fixated',
  label: 'Was fixated',
  description:
    'Per AOI: whether the participant fixated it (1) or not (0), meeting the optional fixation-count / dwell threshold. Aggregated across participants as a proportion, this is the per-AOI noticed rate — the fraction of participants who looked at it.',
  unit: '%',
  category: 'binary',
  rawShape: 'aoi-vector',
  windowUnit: 'ms',
  // Proportion: a per-participant 0/1 indicator. The cross-participant value is
  // the fraction of participants (the noticed-rate), and the class flips the bar
  // plot to a proportional render instead of a beeswarm.
  measurementClass: 'proportion',
  supportsWindowing: false,
  searchTags: ['fixated', 'hit', 'hit ratio', 'noticed', 'presence', 'attention', 'capture', 'rate', 'proportion', 'aoi'],
  params: [minFixationCount, minDwellMs] as const,
  init: ({ slots, params }) => ({
    count: new Float64Array(slots.totalSlots),
    dwell: new Float64Array(slots.totalSlots),
    minFix: params.minFixationCount,
    minDwell: params.minDwellMs,
  }),
  onFixation: (acc, { frame, slots }, { slots: info }) => {
    // SW-RQA window convention: a fixation belongs to the window containing its
    // midpoint. Unbounded scopes always pass, so non-windowed queries are unaffected.
    if (!frame.midpointInWindow) return
    const dur = frame.duration
    if (slots.length === 0) {
      acc.count[info.noAoiSlot]++
      acc.dwell[info.noAoiSlot] += dur
      return
    }
    for (let i = 0; i < slots.length; i++) {
      acc.count[slots[i]]++
      acc.dwell[slots[i]] += dur
    }
  },
  // Per AOI: 1 if the cumulative count and dwell met the threshold, else a finite 0.
  finalize: (acc) => {
    const out = new Array<number>(acc.count.length)
    for (let i = 0; i < out.length; i++) {
      out[i] = acc.count[i] >= acc.minFix && acc.dwell[i] >= acc.minDwell ? 1 : 0
    }
    return out
  },
  // One finite 0/1 per participant for the slot — the bar plot averages these
  // across participants to get the noticed rate.
  individuals: (acc, slotIndex) => [
    acc.count[slotIndex] >= acc.minFix && acc.dwell[slotIndex] >= acc.minDwell ? 1 : 0,
  ],
})
