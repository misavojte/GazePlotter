import { determineCsvDelimiter } from './lib/rows/csvDelimiter'
import { defineRowFormat } from './lib/rows/defineRowFormat'
import { CsvRowParser } from './lib/rows/CsvRowParser'

/**
 * Plain time-series CSV (Time/Participant/Stimulus/AOI columns).
 *
 * CHARACTERIZED QUIRK: the sniff splits the header by ',' only, so a
 * semicolon-delimited time-series CSV is NOT recognized (classifies as
 * unknown). Only the segmented variants (substring sniffs) reach the ';'
 * delimiter branch. Pinned in the detection characterization tests.
 */
export const csvFormat = defineRowFormat({
  ids: ['csv'],
  displayName: 'CSV (time series)',
  detect: probe => {
    const headerColumns = probe.headerRow.split(',')
    return headerColumns.includes('Time') &&
      headerColumns.includes('Participant') &&
      headerColumns.includes('Stimulus') &&
      headerColumns.includes('AOI')
      ? 'csv'
      : null
  },
  columnDelimiter: determineCsvDelimiter,
  createRowParser: ctx =>
    new CsvRowParser(
      ctx.header,
      ctx.settings.columnDelimiter,
      ctx.settings.encoding
    ),
})
