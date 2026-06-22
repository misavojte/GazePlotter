import { defineRowFormat } from './lib/rows/defineRowFormat'
import { BeGazeRowParser } from './lib/rows/BeGazeRowParser'

/** SMI BeGaze event-statistics TSV export. */
export const beGazeFormat = defineRowFormat({
  ids: ['begaze'],
  displayName: 'SMI BeGaze',
  detect: probe =>
    probe.slice.includes('Event Start Trial Time [ms]') &&
    probe.slice.includes('Event End Trial Time [ms]')
      ? 'begaze'
      : null,
  columnDelimiter: '\t',
  createRowParser: ctx =>
    new BeGazeRowParser(
      ctx.header,
      ctx.settings.columnDelimiter,
      ctx.settings.encoding
    ),
})
