import { defineRowFormat } from './lib/rows/defineRowFormat'
import { TobiiRowParser } from './lib/rows/TobiiRowParser'

/**
 * Tobii Pro Lab TSV export. Two type ids from one sniffer: files carrying
 * an `Event` column resolve to 'tobii-with-event' and prompt the user for
 * interval-based media parsing (e.g. "IntervalStart;IntervalEnd").
 */
export const tobiiFormat = defineRowFormat({
  ids: ['tobii', 'tobii-with-event'],
  displayName: 'Tobii Pro Lab',
  detect: probe => {
    if (!probe.slice.includes('Recording timestamp')) return null
    return probe.slice.includes('Event') ? 'tobii-with-event' : 'tobii'
  },
  columnDelimiter: '\t',
  promptId: 'tobii-parsing-input',
  requiresUserInput: typeId => typeId === 'tobii-with-event',
  emptyDatasetError: userInput =>
    userInput !== ''
      ? 'No intervals to form stimuli were found. Try default media parsing.'
      : null,
  createRowParser: ctx =>
    new TobiiRowParser(
      ctx.header,
      ctx.userInput,
      ctx.settings.columnDelimiter,
      ctx.settings.encoding,
      ctx.headerBytes
    ),
})
