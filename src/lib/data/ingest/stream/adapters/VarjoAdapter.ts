import { AbstractAdapter } from './AbstractAdapter'
import { bytesEqual, encodeString } from '$lib/data/ingest/utils/byteUtils'

export class VarjoAdapter extends AbstractAdapter {
  cTime: number
  cActorLabel: number // ActorLabel stands for AOI

  private readonly pTime = 0
  private readonly pActorLabel = 1

  mTimeStart = 0
  mTimeLast = 0
  mTimeBase: number | null = null
  mActorLabelBytes: Uint8Array | null = null
  mParticipant: string
  private readonly textDecoder: TextDecoder
  private readonly participantBytes: Uint8Array
  private readonly stimulusBytes: Uint8Array
  constructor(
    header: string[],
    fileName: string,
    columnDelimiter: string,
    encoding: 'utf-8' | 'utf-16le' | 'utf-16be' = 'utf-8'
  ) {
    super(columnDelimiter, encoding)
    this.textDecoder = new TextDecoder(this.encoding)
    this.cTime = this.getIndex(header, 'Time')
    this.cActorLabel = this.getIndex(header, 'Actor Label')
    this.mParticipant = fileName.split('.')[0]
    this.participantBytes = encodeString(this.mParticipant, this.encoding)
    this.stimulusBytes = encodeString('VarjoScene', this.encoding)

    this.setupColumns([this.cTime, this.cActorLabel])
  }

  protected deserializeFromBytes(_rawRowRef: Uint8Array): void {
    const timeBytes = this.getBytes(this.pTime)
    const actorLabelBytes = this.getBytes(this.pActorLabel)
    if (!timeBytes.length) return

    const timeText = this.textDecoder.decode(timeBytes)
    const timeNumber = this.convertStringTime(timeText)
    const isNewSegment = !bytesEqual(actorLabelBytes, this.mActorLabelBytes)

    if (this.mTimeBase === null) this.mTimeBase = timeNumber
    if (isNewSegment) {
      this.finalize()
      this.mTimeStart = timeNumber
      this.mActorLabelBytes = actorLabelBytes.length ? actorLabelBytes : null
    }
    this.mTimeLast = timeNumber
  }

  finalize(): void {
    const baseTime = this.mTimeBase
    if (baseTime === null) return
    if (!this.mActorLabelBytes || !this.mActorLabelBytes.length) return

    const start = this.mTimeStart - baseTime
    const end = this.mTimeLast - baseTime
    const aoi = [this.mActorLabelBytes]

    this.emitSegment(
      start,
      end,
      0,
      this.stimulusBytes,
      this.participantBytes,
      aoi
    )
  }

  convertStringTime(time: string): number {
    // From format "2022:11:11:15:50:18:30"
    const timeArray = time.split(':')
    return new Date(
      Number(timeArray[0]),
      Number(timeArray[1]),
      Number(timeArray[2]),
      Number(timeArray[3]),
      Number(timeArray[4]),
      Number(timeArray[5]),
      Number(timeArray[6])
    ).getTime()
  }
}
