import { AbstractAdapter } from './AbstractAdapter'
import {
  bytesEqual,
  splitAoiColumn,
  encodeString,
} from '$lib/data/ingest/utils/byteUtils'

// BEWARE! If only one timestamp for whole segment, start and end are the same!
export class CsvAdapter extends AbstractAdapter {
  cTime: number
  cParticipant: number
  cStimulus: number
  cAoi: number
  cX: number
  cY: number

  private readonly pTime = 0
  private readonly pAoi = 1
  private readonly pParticipant = 2
  private readonly pStimulus = 3
  private readonly pX = 4
  private readonly pY = 5

  mTimeStart = 0
  mTimeLast = 0
  mTimeBase: number | null = null
  mAoiBytes: Uint8Array | null = null
  mParticipantBytes: Uint8Array | null = null
  mStimulusBytes: Uint8Array | null = null
  mSpatialX: number | null = null
  mSpatialY: number | null = null
  protected readonly pipeDelimiterBytes: Uint8Array
  constructor(
    header: string[],
    columnDelimiter: string,
    encoding: 'utf-8' | 'utf-16le' | 'utf-16be' = 'utf-8'
  ) {
    super(columnDelimiter, encoding)
    this.cTime = this.getIndex(header, 'Time')
    this.cAoi = this.getIndex(header, 'AOI')
    this.cParticipant = this.getIndex(header, 'Participant')
    this.cStimulus = this.getIndex(header, 'Stimulus')
    this.cX = this.findOptionalColumn(header, 'x')
    this.cY = this.findOptionalColumn(header, 'y')
    this.pipeDelimiterBytes = encodeString('|', encoding)

    this.setupColumns([
      this.cTime,
      this.cAoi,
      this.cParticipant,
      this.cStimulus,
      this.cX,
      this.cY,
    ])
  }

  protected deserializeFromBytes(_rawRowRef: Uint8Array): void {
    const time = this.getNumber(this.pTime)
    if (!Number.isFinite(time)) return

    const aoiBytes = this.getBytes(this.pAoi)
    const participantBytes = this.getBytes(this.pParticipant)
    const stimulusBytes = this.getBytes(this.pStimulus)

    const isNewSegment =
      !bytesEqual(aoiBytes, this.mAoiBytes) ||
      !bytesEqual(participantBytes, this.mParticipantBytes) ||
      !bytesEqual(stimulusBytes, this.mStimulusBytes)

    const isNewTimebase =
      this.mTimeBase === null ||
      !bytesEqual(participantBytes, this.mParticipantBytes) ||
      !bytesEqual(stimulusBytes, this.mStimulusBytes)

    if (this.mTimeBase === null) this.mTimeBase = time
    if (isNewSegment) {
      this.finalize()
      this.mTimeStart = time
      this.mAoiBytes = aoiBytes.length ? aoiBytes : null
      this.mParticipantBytes = participantBytes.length ? participantBytes : null
      this.mStimulusBytes = stimulusBytes.length ? stimulusBytes : null
      this.mSpatialX = null
      this.mSpatialY = null
    }

    if (this.mSpatialX === null || this.mSpatialY === null) {
      const x = this.getNumber(this.pX)
      const y = this.getNumber(this.pY)
      if (Number.isFinite(x) && Number.isFinite(y)) {
        this.mSpatialX = x
        this.mSpatialY = y
      }
    }

    if (isNewTimebase) this.mTimeBase = time
    this.mTimeLast = time
  }

  finalize(): void {
    const baseTime = this.mTimeBase
    if (baseTime === null) return
    if (!this.mParticipantBytes || !this.mStimulusBytes) return

    const start = this.mTimeStart - baseTime
    const end = this.mTimeLast - baseTime
    const aoi = this.mAoiBytes
      ? splitAoiColumn(this.mAoiBytes, this.pipeDelimiterBytes)
      : null
    const hasSpatialColumns = this.cX !== -1 && this.cY !== -1
    const spatial = hasSpatialColumns
      ? this.mSpatialX !== null && this.mSpatialY !== null
        ? { x: this.mSpatialX, y: this.mSpatialY }
        : null
      : undefined

    this.emitSegment(
      start,
      end,
      0,
      this.mStimulusBytes,
      this.mParticipantBytes,
      aoi,
      spatial
    )
  }

  private findOptionalColumn(header: string[], target: string): number {
    for (let i = 0; i < header.length; i++) {
      if (header[i].trim().toLowerCase() === target) return i
    }
    return -1
  }
}
