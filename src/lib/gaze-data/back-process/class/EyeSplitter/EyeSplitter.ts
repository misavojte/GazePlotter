import type { EyeSettingsType } from '$lib/gaze-data/back-process/types/EyeSettingsType.js'

/**
 * Splits a string chunks produced by EyeParser into rows and columns.
 *
 * It can happen that a row is split into multiple chunks, so we need to
 * keep track of the last row and append the next chunk to it.
 */
export class EyeSplitter {
  readonly rowDelimiter: string
  lastRow = ''

  constructor(settings: EyeSettingsType) {
    this.rowDelimiter = settings.rowDelimiter
  }

  splitChunk(chunk: string): string[] {
    const completeRows = (this.lastRow + chunk).split(this.rowDelimiter)
    const completeRowsLength = completeRows.length

    if (completeRowsLength < 2) {
      this.lastRow += chunk
      return []
    }

    this.lastRow = completeRows[completeRowsLength - 1]

    return completeRows.slice(0, completeRowsLength - 1)
  }

  release(): string[] {
    const lastRow = this.lastRow + this.rowDelimiter
    return lastRow.split(this.rowDelimiter)
  }
}
