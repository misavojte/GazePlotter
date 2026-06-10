import { RowParser } from './RowParser'
import { bytesEqual, encodeString } from '$lib/data/ingest/utils/byteUtils'

export class BeGazeRowParser extends RowParser {
  cStart: number
  cEnd: number
  cStimulus: number
  cParticipant: number
  cCategory: number
  cAoi: number

  private readonly pStart = 0
  private readonly pEnd = 1
  private readonly pStimulus = 2
  private readonly pParticipant = 3
  private readonly pCategory = 4
  private readonly pAoi = 5

  private readonly separatorBytes: Uint8Array
  private readonly dashBytes: Uint8Array
  private readonly whiteSpaceBytes: Uint8Array
  private readonly fixationBytes: Uint8Array

  constructor(
    header: string[],
    columnDelimiter: string,
    encoding: 'utf-8' | 'utf-16le' | 'utf-16be' = 'utf-8'
  ) {
    super(columnDelimiter, encoding)
    this.separatorBytes = encodeString('Separator', this.encoding)
    this.dashBytes = encodeString('-', this.encoding)
    this.whiteSpaceBytes = encodeString('White Space', this.encoding)
    this.fixationBytes = encodeString('Fixation', this.encoding)
    this.cStart = this.getIndex(header, 'Event Start Trial Time [ms]')
    this.cEnd = this.getIndex(header, 'Event End Trial Time [ms]')
    this.cStimulus = this.getIndex(header, 'Stimulus')
    this.cParticipant = this.getIndex(header, 'Participant')
    this.cCategory = this.getIndex(header, 'Category')
    this.cAoi = this.getIndex(header, 'AOI Name')

    this.setupColumns([
      this.cStart,
      this.cEnd,
      this.cStimulus,
      this.cParticipant,
      this.cCategory,
      this.cAoi,
    ])
  }

  protected deserializeFromBytes(_rawRowRef: Uint8Array): void {
    const startNum = this.getNumber(this.pStart)
    const endNum = this.getNumber(this.pEnd)
    if (!Number.isFinite(startNum) || !Number.isFinite(endNum)) return

    const stimulusBytes = this.getBytes(this.pStimulus)
    const participantBytes = this.getBytes(this.pParticipant)
    const categoryBytes = this.getBytes(this.pCategory)
    const aoiBytes = this.getBytes(this.pAoi)

    if (bytesEqual(categoryBytes, this.separatorBytes)) return

    let aoi: Uint8Array[] | null = null
    if (
      aoiBytes.length &&
      !bytesEqual(aoiBytes, this.dashBytes) &&
      !bytesEqual(aoiBytes, this.whiteSpaceBytes)
    ) {
      aoi = [aoiBytes]
    }

    const categoryId = bytesEqual(categoryBytes, this.fixationBytes) ? 0 : 1
    this.emitSegment(
      startNum,
      endNum,
      categoryId,
      stimulusBytes,
      participantBytes,
      aoi
    )
  }

  finalize(): void {
    return
  }
}
