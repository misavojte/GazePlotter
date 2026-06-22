import { defineRowFormat } from './lib/rows/defineRowFormat'
import { OgamaRowParser } from './lib/rows/OgamaRowParser'

/**
 * OGAMA scanpath-similarity export. The real header sits on row 8 — the
 * file opens with a block of `#` comment lines.
 */
export const ogamaFormat = defineRowFormat({
  ids: ['ogama'],
  displayName: 'OGAMA',
  detect: probe =>
    probe.slice.includes('# Contents: Similarity Measurements of scanpaths.')
      ? 'ogama'
      : null,
  columnDelimiter: '\t',
  headerRowId: 8,
  createRowParser: ctx =>
    new OgamaRowParser(
      ctx.header,
      ctx.fileName,
      ctx.settings.columnDelimiter,
      ctx.settings.encoding
    ),
})
