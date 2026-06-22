import { defineRowFormat } from './lib/rows/defineRowFormat'
import { GazePointRowParser } from './lib/rows/GazePointRowParser'

/** GazePoint CSV export (fixation + blink columns; stimulus from media columns). */
export const gazePointFormat = defineRowFormat({
  ids: ['gazepoint'],
  displayName: 'GazePoint',
  detect: probe =>
    probe.slice.includes('FPOGS') && probe.slice.includes('FPOGD')
      ? 'gazepoint'
      : null,
  columnDelimiter: ',',
  createRowParser: ctx =>
    new GazePointRowParser(
      ctx.header,
      ctx.fileName,
      ctx.settings.columnDelimiter,
      ctx.settings.encoding
    ),
})
