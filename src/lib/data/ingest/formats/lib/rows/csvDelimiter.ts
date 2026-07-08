import type { SourceProbe } from '../../../kernel/source'

/**
 * THE one CSV delimiter rule, for every CSV surface (stream formats and the
 * event enrichment): count ',' vs ';' in the header row; ',' must be strictly
 * more frequent to win — a tie resolves to ';'. Pinned by
 * `tests/ingestCharacterization.detection.test.ts`.
 */
export function csvDelimiterOfHeader(headerRow: string): string {
  const internationalDelimiter = ','
  const germanDelimiter = ';'
  const internationalDelimiterCount = headerRow.split(
    internationalDelimiter
  ).length
  const germanDelimiterCount = headerRow.split(germanDelimiter).length
  return internationalDelimiterCount > germanDelimiterCount
    ? internationalDelimiter
    : germanDelimiter
}

/** Probe-shaped entry point for stream-format `columnDelimiter` hooks. */
export function determineCsvDelimiter(probe: SourceProbe): string {
  return csvDelimiterOfHeader(probe.headerRow)
}
