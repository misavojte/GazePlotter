import type {
  IntervalDraft,
  IntervalDraftPreview,
} from '$lib/data/engine'

/**
 * Draft-row rules for the Create-intervals step, kept out of the component
 * for unit testing. Rows come from two feeders — the suffix-pattern
 * generator and manual pairing — and share one preview/inclusion pipeline.
 */

/** What to do with pairs whose occurrences don't alternate cleanly. */
export type ErrorPairPolicy = 'skip' | 'lenient'

export interface DraftRow {
  draft: IntervalDraft
  origin: 'pattern' | 'manual'
  checked: boolean
}

/**
 * Whether a row may be included in the batch: it must have a valid name,
 * produce at least one interval, and — under the default strict policy —
 * pair without any error. Lenient policy admits rows with skips (sound
 * because originals are untouched; the skipped occurrences stay visible
 * in the source channels).
 */
export function rowIncludable(
  preview: IntervalDraftPreview,
  policy: ErrorPairPolicy
): boolean {
  if (preview.nameError !== undefined) return false
  if (preview.pairedCount === 0) return false
  return preview.skippedCount === 0 || policy === 'lenient'
}

/**
 * Suffix edits regenerate the pattern proposals: pattern rows are replaced
 * wholesale (any name edits on them reset — accepted), manual rows are
 * kept verbatim after them.
 */
export function reconcileDraftRows(
  rows: DraftRow[],
  proposals: IntervalDraft[]
): DraftRow[] {
  return [
    ...proposals.map(draft => ({
      draft,
      origin: 'pattern' as const,
      checked: true,
    })),
    ...rows.filter(row => row.origin === 'manual'),
  ]
}

/**
 * Default name for a manual pair: the trimmed common prefix of the two
 * channel names (separators stripped), falling back to the start name.
 */
export function defaultManualName(startName: string, endName: string): string {
  let common = 0
  const max = Math.min(startName.length, endName.length)
  while (common < max && startName[common] === endName[common]) common++
  const stem = startName
    .slice(0, common)
    .replace(/[\s\-_./]+$/, '')
    .trim()
  return stem || startName
}
