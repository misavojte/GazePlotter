import { defineMetric } from '../../core/defineMetric'

defineMetric({
  id: 'fixationCount',
  label: 'Fixation count',
  description: 'Per AOI: count of fixations whose dwell covers it. A fixation tagged with multiple AOIs counts in each. The any-fixation aggregate equals the total fixation count regardless of AOI.',
  unit: 'count',
  category: 'counts',
  rawShape: 'aoi-vector',
  windowUnit: 'ms',
  providesAnyFixation: true,
  aoiAggregate: { max: 'most-fixated AOI', min: 'least-fixated AOI' },
  measurementClass: 'extensive',
  searchTags: ['fixation', 'count', 'number', 'fix', 'aoi'],
  params: [] as const,
  accumulation: 'midpointCount',
  init: ({ slots }) => new Float64Array(slots.totalSlots),
  onFixation: (acc, { frame, slots }, { slots: info }) => {
    // SW-RQA membership: a fixation counts in exactly one window, the one
    // containing its midpoint, so per-window counts sum to the total.
    if (!frame.midpointInWindow) return
    acc[info.anyFixationSlot]++
    if (slots.length === 0) { acc[info.noAoiSlot]++; return }
    for (let i = 0; i < slots.length; i++) acc[slots[i]]++
  },
  finalize: (acc) => Array.from(acc),
})
