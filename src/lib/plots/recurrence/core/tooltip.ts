import type { RecurrenceData } from '../types'

/** Tooltip rows for the fixation pair (row = fixation i, col = fixation j, 0-based). */
export function buildRecurrenceTooltipContent(
  data: RecurrenceData,
  row: number,
  col: number
): Array<{ key: string; value: string }> {
  const idx = row * data.fixationCount + col
  const isRecurrent = !!data.matrix[idx]
  const content = [
    { key: 'Fixation j', value: (col + 1).toString() },
    { key: 'Fixation i', value: (row + 1).toString() },
    { key: 'Recurrent', value: isRecurrent ? 'Yes' : 'No' },
  ]
  if (isRecurrent && data.durationMatrix) {
    content.push({ key: 'Duration sum', value: data.durationMatrix[idx].toFixed(1) })
  }
  return content
}
