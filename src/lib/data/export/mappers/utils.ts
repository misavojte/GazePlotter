import { type CsvFormatOptions, generateCsvString } from '../encoders/csv'

interface GroupedCsvPreItem {
  participant: string
  stimulus: string
}

/** The unified export merely prepends the grouping columns to a batch row. */
export function unifiedCsv<T extends GroupedCsvPreItem>(
  data: T[],
  batchHeader: string[],
  cells: (item: T) => string[],
  options?: CsvFormatOptions
): string {
  return generateCsvString(
    ['stimulus', 'participant', ...batchHeader],
    data.map(item => [item.stimulus, item.participant, ...cells(item)]),
    options
  )
}

/** One `<stimulus>_<participant>` CSV per participant/stimulus pair with rows. */
export function batchCsvs<T extends GroupedCsvPreItem>(
  data: T[],
  header: string[],
  cells: (item: T) => string[],
  options?: CsvFormatOptions
): Array<{ fileName: string; content: string }> {
  const results: Array<{ fileName: string; content: string }> = []

  const participants = Array.from(new Set(data.map(item => item.participant)))
  const stimuli = Array.from(new Set(data.map(item => item.stimulus)))

  for (const participant of participants) {
    for (const stimulus of stimuli) {
      const combinedData = data.filter(
        item => item.participant === participant && item.stimulus === stimulus
      )

      if (combinedData.length === 0) continue

      results.push({
        fileName: `${stimulus}_${participant}`,
        content: generateCsvString(header, combinedData.map(cells), options),
      })
    }
  }

  return results
}
