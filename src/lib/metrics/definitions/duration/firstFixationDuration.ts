import { defineFirstHitMetric } from '../ttf/defineFirstHitMetric'

defineFirstHitMetric({
  id: 'firstFixationDuration',
  label: 'First fixation duration',
  description: 'Per AOI: duration (ms) of the first fixation that landed inside it. Reflects initial processing depth on first encounter. No value if the AOI was never fixated.',
  searchTags: ['first', 'fixation', 'duration', 'ttf', 'aoi'],
  extractValue: (fix) => fix.duration,
})
