import type { RecurrenceData } from '../types'

/**
 * Tooltip rows for the fixation pair (row = fixation i, col = fixation j, 0-based):
 * the pair on one line, its AOIs, whether it recurs, and the duration sum. A
 * spatial method can pair fixations on different AOIs: then the AOI row names
 * both sides, split by a semicolon as one side may list several AOIs.
 */
export function buildRecurrenceTooltipContent(
  data: RecurrenceData,
  row: number,
  col: number
): Array<{ key: string; value: string }> {
  const idx = row * data.fixationCount + col
  const isRecurrent = !!data.matrix[idx]
  const content = [{ key: 'Fixations', value: `i ${row + 1}, j ${col + 1}` }]
  if (data.fixationAois) {
    const aoiI = data.fixationAois[row] || 'None'
    const aoiJ = data.fixationAois[col] || 'None'
    content.push({ key: 'AOI', value: aoiI === aoiJ ? aoiI : `i ${aoiI}; j ${aoiJ}` })
  }
  content.push({ key: 'Recurrent', value: isRecurrent ? 'Yes' : 'No' })
  if (isRecurrent && data.durationMatrix) {
    content.push({ key: 'Duration sum', value: `${data.durationMatrix[idx].toFixed(0)} ms` })
  }
  return content
}
