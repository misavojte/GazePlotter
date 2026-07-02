import { sanitizeFileName, type ExportFileType } from '$lib/data/export'

/**
 * Zip entry name for one figure of a batch: `03 AOI Comparison - SMI Base.png`.
 * The position prefix preserves workspace order and guarantees uniqueness even
 * when several figures share a name; qualifiers (the plot's subtitle values,
 * e.g. stimulus and group) disambiguate same-type plots for the reader.
 */
export function buildFigureEntryName(params: {
  /** 1-based position of the figure in the batch. */
  position: number
  /** Batch size — determines the zero-padding width of the prefix. */
  total: number
  name: string
  qualifiers: string[]
  extension: ExportFileType
}): string {
  const digits = Math.max(2, String(params.total).length)
  const prefix = String(params.position).padStart(digits, '0')
  const qualifier = params.qualifiers
    .map(value => value.trim())
    .filter(value => value.length > 0)
    .join(', ')
  const base = qualifier ? `${params.name} - ${qualifier}` : params.name
  return `${prefix} ${sanitizeFileName(base)}${params.extension}`
}
