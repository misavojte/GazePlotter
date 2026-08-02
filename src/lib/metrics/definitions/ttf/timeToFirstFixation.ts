import { defineFirstHitMetric } from './defineFirstHitMetric'

defineFirstHitMetric({
  id: 'timeToFirstFixation',
  label: 'Time to first fixation',
  description: 'Per AOI: elapsed time (ms) from stimulus onset to the first fixation that landed in the AOI. Lower values mean the AOI captured attention earlier. No value if the AOI was never fixated.',
  searchTags: ['ttff', 'ttf', 'first', 'fixation', 'time', 'latency', 'onset', 'aoi'],
  aoiAggregate: { min: 'first-reached AOI', max: 'last-reached AOI' },
  extractValue: (fix) => fix.start,
})
