import type { EyeSettingsType } from '$lib/gaze-data/back-process/types/EyeSettingsType.js'

export class EyeSplitter {
  readonly rowDelimiter: string
  readonly rowDelimiterLength: number

  lastRow = ''

  constructor(settings: EyeSettingsType) {
    this.rowDelimiter = settings.rowDelimiter
    this.rowDelimiterLength = settings.rowDelimiter.length
  }

  splitChunk(chunk: string): string[] {
    // 1. Scan for the LAST delimiter to isolate the 'Tail'
    // We use lastIndexOf because we want to slice the 'Body' in one go.
    const lastDelimIndex = chunk.lastIndexOf(this.rowDelimiter)

    // Case A: The chunk contains NO newlines.
    // It is entirely part of a partial row. Append and wait for more.
    if (lastDelimIndex === -1) {
      this.lastRow += chunk
      return []
    }

    // 2. Identify the 'Tail' (Next leftover)
    // Everything after the last delimiter is the start of the next row.
    const nextLastRow = chunk.substring(
      lastDelimIndex + this.rowDelimiterLength
    )

    // 3. Identify the 'Content' (Head + Body)
    // Everything up to the last delimiter.
    const content = chunk.substring(0, lastDelimIndex)

    let rows: string[]

    // 4. Handle the 'Head' (Previous leftover)
    if (this.lastRow !== '') {
      // If we have a leftover, we prepend it to the content.
      // NOTE: This does allocate a new string, but we can't avoid joining
      // the split parts. Native split is still faster than manual looping
      // even with this concat.
      rows = (this.lastRow + content).split(this.rowDelimiter)
    } else {
      // Fast path: Pure native split
      rows = content.split(this.rowDelimiter)
    }

    // Update state
    this.lastRow = nextLastRow
    return rows
  }

  release(): string[] {
    if (this.lastRow === '') return []
    const final = this.lastRow
    this.lastRow = ''
    return [final]
  }
}
