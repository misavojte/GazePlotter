import { defineMetric } from '../../core/defineMetric'
import { integerParam, numberParam } from '../../core/params'

/**
 * 0 or 100, not 0/1, so the values match the declared `%` unit and every
 * consumer reads them unscaled. A never-fixated AOI emits a finite 0, never
 * NaN — it must stay in the denominator or the noticed rate inflates.
 * Windowed, thresholds are evaluated within the window (one larger than the
 * window trivially yields 0).
 */
const minFixationCount = integerParam('minFixationCount', 'Min fixations', 1, {
  min: 1,
  description:
    'Minimum number of fixations on the AOI to count as fixated — within the window when windowed, else within the recording.',
})
const minDwellMs = numberParam('minDwellMs', 'Min dwell', 0, {
  min: 0,
  unit: 'ms',
  description:
    'Minimum total dwell time (ms) on the AOI to count as fixated — within the window when windowed, else within the recording.',
})

defineMetric({
  id: 'fixated',
  label: 'Was fixated',
  description:
    'Per AOI: whether the participant fixated it (100%) or not (0%), meeting the optional fixation-count / dwell threshold. Averaged across participants this is the per-AOI noticed rate — the percentage of participants who looked at it.',
  unit: '%',
  category: 'binary',
  rawShape: 'aoi-vector',
  windowUnit: 'ms',
  // Extremes over 0/100 indicators are set logic: max = OR, min = AND.
  aoiAggregate: { max: 'at least one AOI', min: 'every AOI' },
  // Also flips the bar plot to a proportional render instead of a beeswarm.
  measurementClass: 'proportion',
  searchTags: ['fixated', 'hit', 'hit ratio', 'noticed', 'presence', 'attention', 'capture', 'rate', 'proportion', 'aoi', 'visible'],
  params: [minFixationCount, minDwellMs] as const,
  accumulation: 'stateful',
  init: ({ slots, params }) => ({
    count: new Float64Array(slots.totalSlots),
    dwell: new Float64Array(slots.totalSlots),
    minFix: params.minFixationCount,
    minDwell: params.minDwellMs,
  }),
  onFixation: (acc, { frame, slots }, { slots: info }) => {
    // SW-RQA membership; see fixationCount.
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
  // No `individuals`: the per-participant value IS the single observation, and
  // queryPooledIndividuals already contributes exactly that from the cached
  // aggregate. Declaring the hook would only buy an extra uncached scan.
  finalize: (acc) => {
    const out = new Array<number>(acc.count.length)
    for (let i = 0; i < out.length; i++) {
      out[i] = acc.count[i] >= acc.minFix && acc.dwell[i] >= acc.minDwell ? 100 : 0
    }
    return out
  },
})
