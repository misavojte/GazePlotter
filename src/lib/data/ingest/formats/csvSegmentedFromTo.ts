import { determineCsvDelimiter } from './lib/rows/csvDelimiter'
import { defineRowFormat } from './lib/rows/defineRowFormat'
import { CsvSegmentedFromToRowParser } from './lib/rows/CsvSegmentedFromToRowParser'

/** Segmented CSV with From/To timestamp columns (one row per segment). */
export const csvSegmentedFromToFormat = defineRowFormat({
  ids: ['csv-segmented'],
  displayName: 'CSV (segmented, From/To)',
  detect: probe =>
    probe.slice.includes('From') &&
    probe.slice.includes('To') &&
    probe.slice.includes('Participant') &&
    probe.slice.includes('Stimulus') &&
    probe.slice.includes('AOI')
      ? 'csv-segmented'
      : null,
  columnDelimiter: determineCsvDelimiter,
  createRowParser: ctx =>
    new CsvSegmentedFromToRowParser(
      ctx.header,
      ctx.settings.columnDelimiter,
      ctx.settings.encoding
    ),
})
