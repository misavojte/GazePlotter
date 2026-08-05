import { defineMetric } from '../../core/defineMetric'

defineMetric({
  id: 'absoluteTime',
  label: 'Absolute dwell time',
  description: 'Per AOI: total dwell time (ms) — summed durations of fixations whose dwell covers the AOI. Higher values mean more total attention there.',
  unit: 'ms',
  category: 'duration',
  rawShape: 'aoi-vector',
  windowUnit: 'ms',
  providesAnyFixation: true,
  // Never-fixated AOIs finalize to a finite 0, so min honestly includes them.
  aoiAggregate: { max: 'most-dwelled AOI', min: 'least-dwelled AOI' },
  measurementClass: 'extensive',
  searchTags: ['dwell', 'gaze', 'time', 'absolute', 'total', 'duration', 'aoi'],
  params: [] as const,
  // Time is divisible: clipping each fixation to the window already partitions it,
  // so every overlapping window takes its share and the shares sum to the total.
  windowMembership: 'all',
  accumulation: 'clippedDuration',
  init: ({ slots }) => new Float64Array(slots.totalSlots),
  onFixation: (acc, { frame, slots }, { slots: info }) => {
    // frame.duration, not fix.duration: a fixation crossing a window boundary
    // contributes only its in-window overlap. Equal on unbounded scopes.
    const dur = frame.duration
    acc[info.anyFixationSlot] += dur
    if (slots.length === 0) acc[info.noAoiSlot] += dur
    else for (let i = 0; i < slots.length; i++) acc[slots[i]] += dur
  },
  finalize: (acc) => Array.from(acc),
})
