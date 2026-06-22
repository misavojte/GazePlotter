import { determineCsvDelimiter } from './lib/rows/csvDelimiter'
import { defineRowFormat } from './lib/rows/defineRowFormat'
import { CsvSegmentedDurationRowParser } from './lib/rows/CsvSegmentedDurationRowParser'

/**
 * Duration-based segmented CSV: timestamp + duration columns and an
 * `eyemovementtype` code (0 = Fixation, 1 = Saccade). More specific than
 * the From/To variant, so it sits earlier in the registry.
 */
export const csvSegmentedDurationFormat = defineRowFormat({
  ids: ['csv-segmented-duration'],
  displayName: 'CSV (segmented, duration)',
  detect: probe =>
    probe.slice.includes('timestamp') &&
    probe.slice.includes('duration') &&
    probe.slice.includes('eyemovementtype') &&
    probe.slice.includes('participant') &&
    probe.slice.includes('stimulus') &&
    probe.slice.includes('AOI')
      ? 'csv-segmented-duration'
      : null,
  columnDelimiter: determineCsvDelimiter,
  createRowParser: ctx =>
    new CsvSegmentedDurationRowParser(
      ctx.header,
      ctx.settings.columnDelimiter,
      ctx.settings.encoding
    ),
})
