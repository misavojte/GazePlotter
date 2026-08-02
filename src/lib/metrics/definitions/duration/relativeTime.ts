import { defineMetric } from '../../core/defineMetric'
import { percentShare } from '../../core/numeric'

defineMetric({
  id: 'relativeTime',
  label: 'Relative dwell time',
  description: "Per AOI: dwell time as a percentage of the participant's total fixation time on the stimulus. Normalises attention across participants with different overall scan durations.",
  unit: '%',
  category: 'duration',
  rawShape: 'aoi-vector',
  windowUnit: 'ms',
  aoiAggregate: { max: 'most-dwelled AOI', min: 'least-dwelled AOI' },
  measurementClass: 'intensive',
  searchTags: ['dwell', 'gaze', 'time', 'relative', 'percent', 'proportion', 'duration', 'aoi'],
  params: [] as const,
  accumulation: 'clippedDurationShare',
  init: ({ slots }) => new Float64Array(slots.totalSlots),
  onFixation: (acc, { frame, slots }, { slots: info }) => {
    const dur = frame.duration // in-window overlap; see absoluteTime
    acc[info.anyFixationSlot] += dur
    if (slots.length === 0) acc[info.noAoiSlot] += dur
    else for (let i = 0; i < slots.length; i++) acc[slots[i]] += dur
  },
  // Denominator is the anyFixation slot, NOT the sum of AOI slots — that would
  // count every fixation twice (its slot + anyFixation) and halve every
  // percentage. Zero-total → NaN, per percentShare.
  finalize: (acc, slots) => percentShare(acc, acc[slots.anyFixationSlot]),
})
