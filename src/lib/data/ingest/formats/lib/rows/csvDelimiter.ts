import type { SourceProbe } from '../../../kernel/source'

/**
 * To determine the delimiter used in a CSV file, we count the number of
 * occurrences of the two most common delimiters (',' and ';') in the header
 * row. The delimiter with the higher count is used (',' must be strictly
 * more frequent to win — a tie resolves to ';').
 */
export function determineCsvDelimiter(probe: SourceProbe): string {
  const internationalDelimiter = ','
  const germanDelimiter = ';'
  const internationalDelimiterCount = probe.headerRow.split(
    internationalDelimiter
  ).length
  const germanDelimiterCount = probe.headerRow.split(germanDelimiter).length
  return internationalDelimiterCount > germanDelimiterCount
    ? internationalDelimiter
    : germanDelimiter
}
