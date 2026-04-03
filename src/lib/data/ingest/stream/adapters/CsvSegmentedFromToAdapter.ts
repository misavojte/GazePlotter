import { AbstractAdapter } from './AbstractAdapter'
import { splitAoiColumn, encodeString } from '$lib/data/ingest/utils/byteUtils'

/**
 * This class is used to deserialize eye data from a CSV file which contains segments.
 * That means it has information about the start and end of each segment.
 */
export class CsvSegmentedFromToAdapter extends AbstractAdapter {
  cFrom: number
  cTo: number
  cParticipant: number
  cStimulus: number
  cAoi: number
  cX: number
  cY: number

  private readonly pFrom = 0
  private readonly pTo = 1
  private readonly pAoi = 2
  private readonly pParticipant = 3
  private readonly pStimulus = 4
  private readonly pX = 5
  private readonly pY = 6

  protected readonly pipeDelimiterBytes: Uint8Array

  constructor(
    header: string[],
    columnDelimiter: string,
    encoding: 'utf-8' | 'utf-16le' | 'utf-16be' = 'utf-8'
  ) {
    super(columnDelimiter, encoding)
    this.cFrom = this.getIndex(header, 'From')
    this.cTo = this.getIndex(header, 'To')
    this.cAoi = this.getIndex(header, 'AOI')
    this.cParticipant = this.getIndex(header, 'Participant')
    this.cStimulus = this.getIndex(header, 'Stimulus')
    this.cX = this.findOptionalColumn(header, 'x')
    this.cY = this.findOptionalColumn(header, 'y')
    this.pipeDelimiterBytes = encodeString('|', encoding)

    this.setupColumns([
      this.cFrom,
      this.cTo,
      this.cAoi,
      this.cParticipant,
      this.cStimulus,
      this.cX,
      this.cY,
    ])
  }

  /**
   * Deserializes a single row from a CSV file into a DeserializerOutputType object.
   * This function checks the validity of required fields in the row. It does not store
   * any data in memory beyond the scope of this function.
   *
   * Note: This deserializer assumes all constants represent fixations, which may be subject to change.
   *
   * @param {string[]} row - An array representing a single row from the CSV file.
   *                         Expected to contain values for 'from', 'to', 'aoi', 'participant', and 'stimulus'.
   * @returns {void}
   */
  protected deserializeFromBytes(_rawRowRef: Uint8Array): void {
    const from = this.getNumber(this.pFrom)
    const to = this.getNumber(this.pTo)
    const aoiBytes = this.getBytes(this.pAoi)
    const participantBytes = this.getBytes(this.pParticipant)
    const stimulusBytes = this.getBytes(this.pStimulus)

    if (
      !Number.isFinite(from) ||
      !Number.isFinite(to) ||
      participantBytes.length === 0 ||
      stimulusBytes.length === 0
    )
      return

    const aoi =
      aoiBytes.length > 0
        ? splitAoiColumn(aoiBytes, this.pipeDelimiterBytes)
        : null
    const x = this.getNumber(this.pX)
    const y = this.getNumber(this.pY)
    const hasSpatialColumns = this.cX !== -1 && this.cY !== -1
    const spatial = hasSpatialColumns
      ? Number.isFinite(x) && Number.isFinite(y)
        ? { x, y }
        : null
      : undefined

    this.emitSegment(from, to, 0, stimulusBytes, participantBytes, aoi, spatial)
  }

  /**
   * @returns null because this deserializer does not need to finalize anything
   */
  finalize(): void {
    return
  }

  private findOptionalColumn(header: string[], target: string): number {
    for (let i = 0; i < header.length; i++) {
      if (header[i].trim().toLowerCase() === target) return i
    }
    return -1
  }
}
