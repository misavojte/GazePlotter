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
  // Indivisible events, so exactly one window owns each: per-window counts sum to
  // the unwindowed total. Absence is 0 (evaluated, owns nothing), never NaN.
  windowMembership: 'own',
  accumulation: 'midpointCount',
  init: ({ slots }) => new Float64Array(slots.totalSlots),
  onFixation: (acc, { slots }, { slots: info }) => {
    acc[info.anyFixationSlot]++
    if (slots.length === 0) { acc[info.noAoiSlot]++; return }
    for (let i = 0; i < slots.length; i++) acc[slots[i]]++
  },
  finalize: (acc) => Array.from(acc),
})
