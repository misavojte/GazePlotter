import { defineRowFormat } from './lib/rows/defineRowFormat'
import { VarjoRowParser } from './lib/rows/VarjoRowParser'

/**
 * Varjo semicolon-delimited export. NOTE: the sniff is weak ('Time' +
 * 'Actor Label' substrings) — it sits late in the registry so the stronger
 * vendor sniffers win every ambiguous case (see registry order pins).
 */
export const varjoFormat = defineRowFormat({
  ids: ['varjo'],
  displayName: 'Varjo',
  detect: probe =>
    probe.slice.includes('Time') && probe.slice.includes('Actor Label')
      ? 'varjo'
      : null,
  columnDelimiter: ';',
  createRowParser: ctx =>
    new VarjoRowParser(
      ctx.header,
      ctx.fileName,
      ctx.settings.columnDelimiter,
      ctx.settings.encoding
    ),
})
