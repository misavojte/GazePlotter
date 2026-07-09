import { RowParser } from './RowParser'
import { bytesEqual, encodeString } from '$lib/data/ingest/utils/byteUtils'

export class VarjoRowParser extends RowParser {
  cTime: number
  cActorLabel: number // ActorLabel stands for AOI

  private readonly pTime = 0
  private readonly pActorLabel = 1

  mTimeStart = 0
  mTimeLast = 0
  mTimeBase: number | null = null
  mActorLabelBytes: Uint8Array | null = null
  mParticipant: string
  /** Reused per-row scratch for the seven timestamp parts (no allocation). */
  private readonly timeParts = new Int32Array(7)
  private readonly participantBytes: Uint8Array
  private readonly stimulusBytes: Uint8Array
  constructor(
    header: string[],
    fileName: string,
    columnDelimiter: string,
    encoding: 'utf-8' | 'utf-16le' | 'utf-16be' = 'utf-8'
  ) {
    super(columnDelimiter, encoding)
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

    const timeNumber = this.convertTimeBytes(timeBytes)
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

  /**
   * Timestamp bytes "yyyy:MM:dd:HH:mm:ss:SSS" (e.g. "2022:11:11:15:50:18:30")
   * → milliseconds, parsed straight from the column bytes. KEEP hot: this runs
   * per row — no string decode, no split(), no Date object. Only DIFFERENCES
   * of these values survive (finalize subtracts the file's base time), and
   * Date.UTC keeps every delta identical to the former local-time
   * `new Date(...)` conversion except across a DST change mid-recording, where
   * the old code injected a spurious ±1 h jump into the gaze timeline.
   */
  private convertTimeBytes(bytes: Uint8Array): number {
    const parts = this.timeParts
    parts.fill(0)
    const stride = this.encoding === 'utf-8' ? 1 : 2
    const offset = this.encoding === 'utf-16be' ? 1 : 0
    let part = 0
    for (let i = offset; i < bytes.length; i += stride) {
      const c = bytes[i]
      if (c >= 48 && c <= 57) {
        parts[part] = parts[part] * 10 + (c - 48)
      } else if (c === 58 && part < 6) {
        part++
      }
    }
    return Date.UTC(
      parts[0],
      parts[1] - 1, // Months are 0-indexed
      parts[2],
      parts[3],
      parts[4],
      parts[5],
      parts[6]
    )
  }
}
