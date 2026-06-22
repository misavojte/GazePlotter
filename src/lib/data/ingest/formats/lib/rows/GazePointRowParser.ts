import { RowParser } from './RowParser'
import { bytesEqual, encodeString } from '$lib/data/ingest/utils/byteUtils'

/**
 * GazePointRowParser streams raw GazePoint CSV rows into
 * structured fixation and blink events.
 *
 * Features:
 * - Ignores FPOGV validity flags entirely.
 * - Classifies events by FPOGD (fixation duration) and BKID/BKDUR (blink ID/duration).
 * - Flexible header mapping using RegExp, accommodating common variants.
 * - Fixation lifecycle:
 *   • Starts on any row with FPOGD > 0, provided it represents a new or extended segment.
 *   • Ends when FPOGD stops increasing, or when fixation ID or media stimulus changes.
 *   • Prevents re‑starting an already emitted segment (identical ID and non‑increasing duration).
 * - Blink lifecycle:
 *   • Buffers rows with BKID > 0 (using BKDUR to compute start/end).
 *   • Terminates on first BKID == 0, marking end timestamp, emits on subsequent row.
 *
 * ⚠️ Blink alignment is approximate: start/end use row timestamps and duration fields,
 * not per‑sample interpolation—exact frame‑accurate blink timing is not guaranteed.
 *
 * TODO: Improve tioming with duration info in the future
 *
 * Usage:
 *  const des = new GazePointRowParser(header, fileName);
 *  for (const row of rows) {
 *    const evt = des.deserialize(row);
 *    if (evt) handle(evt);
 *  }
 *  const last = des.finalize(); if (last) handle(last);
 */
export class GazePointRowParser extends RowParser {
  private idx = {
    time: -1,
    start: -1,
    fixDur: -1,
    blinkId: -1,
    blinkDur: -1,
    aoi: -1,
    stim: -1,
    id: -1,
    valid: -1,
  }
  private state: 'Idle' | 'Fixation' = 'Idle'
  private currentFix = {
    fixIDBytes: null as Uint8Array | null,
    stimulusBytes: null as Uint8Array | null,
    aoiBytes: null as Uint8Array | null,
    start: 0,
    end: 0,
    lastDur: 0,
  }
  private blinkBuffer: { start: number; end: number } | null = null
  private blinkTerminated = false
  private prevFixIDBytes: Uint8Array | null = null
  private prevFixDur: number = 0
  private participantBytes: Uint8Array
  private readonly fixationNameBytes: Uint8Array
  private readonly blinkNameBytes: Uint8Array
  private readonly invalidNameBytes: Uint8Array
  // Open run of consecutive FPOGV=0 (lost-track) samples, flushed as one
  // "Invalid" segment when tracking resumes (mirrors blinkBuffer).
  private invalidBuffer: {
    start: number
    end: number
    stimulusBytes: Uint8Array | null
  } | null = null

  // Packed columns (strings)
  private readonly pTime = 0
  private readonly pStart = 1
  private readonly pFixDur = 2
  private readonly pBlinkId = 3
  private readonly pBlinkDur = 4
  private readonly pAoi = 5
  private readonly pStim = 6
  private readonly pId = 7
  private readonly pValid = 8

  constructor(
    header: string[],
    fileName: string,
    columnDelimiter: string,
    encoding: 'utf-8' | 'utf-16le' | 'utf-16be' = 'utf-8'
  ) {
    super(columnDelimiter, encoding)
    const find = (pat: RegExp) => header.findIndex(h => pat.test(h))
    this.idx.time = find(/^TIME/) >= 0 ? find(/^TIME/) : header.indexOf('TIME')
    this.idx.start = header.indexOf('FPOGS')
    this.idx.fixDur = header.indexOf('FPOGD')
    this.idx.blinkId = header.indexOf('BKID')
    this.idx.blinkDur = header.indexOf('BKDUR')
    this.idx.aoi = header.indexOf('AOI')
    this.idx.stim = header.indexOf('MEDIA_NAME')
    this.idx.id = header.indexOf('FPOGID')
    // FPOGV is GazePoint's point-of-gaze validity flag (1 = valid, 0 = lost
    // track). Optional: when the column is absent (e.g. older exports), all
    // samples are treated as valid and behaviour is unchanged.
    this.idx.valid = header.indexOf('FPOGV')
    this.participantBytes = encodeString(fileName.split('_')[0], this.encoding)
    this.fixationNameBytes = encodeString('Fixation', this.encoding)
    this.blinkNameBytes = encodeString('Blink', this.encoding)
    this.invalidNameBytes = encodeString('Invalid', this.encoding)

    this.setupColumns([
      this.idx.time,
      this.idx.start,
      this.idx.fixDur,
      this.idx.blinkId,
      this.idx.blinkDur,
      this.idx.aoi,
      this.idx.stim,
      this.idx.id,
      this.idx.valid,
    ])
  }

  protected deserializeFromBytes(_rawRowRef: Uint8Array): void {
    const time = this.getNumber(this.pTime)
    const startRaw = this.getNumber(this.pStart)
    const durFix = this.getNumber(this.pFixDur)
    const blinkIdNum = this.getNumber(this.pBlinkId)
    const blinkDur = this.getNumber(this.pBlinkDur)

    const blinkId = Number.isFinite(blinkIdNum) ? Math.trunc(blinkIdNum) : 0
    const fixDur = Number.isFinite(durFix) ? durFix : 0
    const blinkDuration = Number.isFinite(blinkDur) ? blinkDur : 0

    if (!Number.isFinite(time) || !Number.isFinite(startRaw)) return

    const aoiBytes = this.getBytes(this.pAoi)
    const fixIDBytes = this.getBytes(this.pId)
    const stimBytes = this.getBytes(this.pStim)

    // 0) Validity (FPOGV): lost-track samples are not valid gaze, so they must
    // not be folded into fixations. Reclassify each contiguous FPOGV=0 run as a
    // distinct "Invalid" segment instead of silently inflating fixation counts/
    // durations. No-op when the column is absent (idx.valid === -1).
    if (this.idx.valid !== -1 && this.getNumber(this.pValid) === 0) {
      if (this.state === 'Fixation') {
        this.emitFixation()
        this.state = 'Idle'
      }
      if (!this.invalidBuffer) {
        this.invalidBuffer = {
          start: time,
          end: time,
          stimulusBytes: stimBytes.length
            ? stimBytes
            : this.currentFix.stimulusBytes,
        }
      } else {
        this.invalidBuffer.end = time
      }
      return
    }
    if (this.invalidBuffer) {
      // Tracking resumed — flush the accumulated invalid run as its own segment.
      const sb = this.invalidBuffer.stimulusBytes
      if (sb) {
        this.emitSegment(
          this.invalidBuffer.start,
          this.invalidBuffer.end,
          this.resolveCategoryId(this.invalidNameBytes),
          sb,
          this.participantBytes,
          null
        )
      }
      this.invalidBuffer = null
    }

    // 1) Blink detection
    if (blinkId > 0) {
      this.blinkBuffer = { start: time - blinkDuration, end: time }
      this.blinkTerminated = false
      if (this.state === 'Fixation') {
        this.emitFixation()
        this.state = 'Idle'
      }
      return
    }
    if (this.blinkBuffer) {
      if (!this.blinkTerminated) {
        this.blinkBuffer.end = time
        this.blinkTerminated = true
        return
      }
      const stimBytes = this.currentFix.stimulusBytes
      if (stimBytes) {
        this.emitSegment(
          this.blinkBuffer.start,
          this.blinkBuffer.end,
          this.resolveCategoryId(this.blinkNameBytes),
          stimBytes,
          this.participantBytes,
          null
        )
      }
      this.blinkBuffer = null
      this.blinkTerminated = false
      return
    }

    // 2) Fixation handling
    const isFix = fixDur > 0

    if (this.state === 'Idle') {
      if (
        isFix &&
        (!bytesEqual(fixIDBytes, this.prevFixIDBytes) ||
          fixDur > this.prevFixDur)
      ) {
        this.currentFix = {
          fixIDBytes: fixIDBytes.length ? fixIDBytes : null,
          stimulusBytes: stimBytes.length ? stimBytes : null,
          aoiBytes: aoiBytes.length ? aoiBytes : null,
          start: startRaw,
          end: time,
          lastDur: fixDur,
        }
        this.state = 'Fixation'
      }
      return
    }

    {
      const idChanged = !bytesEqual(fixIDBytes, this.currentFix.fixIDBytes)
      const stimChanged = !bytesEqual(stimBytes, this.currentFix.stimulusBytes)
      const durFallen = fixDur <= this.currentFix.lastDur
      const needFlush = !isFix || idChanged || stimChanged || durFallen
      if (needFlush) {
        this.emitFixation()
        this.state = 'Idle'
        this.prevFixIDBytes = this.currentFix.fixIDBytes
        this.prevFixDur = this.currentFix.lastDur
        if (
          isFix &&
          (!bytesEqual(fixIDBytes, this.prevFixIDBytes) ||
            fixDur > this.prevFixDur)
        ) {
          this.currentFix = {
            fixIDBytes: fixIDBytes.length ? fixIDBytes : null,
            stimulusBytes: stimBytes.length ? stimBytes : null,
            aoiBytes: aoiBytes.length ? aoiBytes : null,
            start: startRaw,
            end: time,
            lastDur: fixDur,
          }
          this.state = 'Fixation'
        }
        return
      }
      this.currentFix.end = time
      this.currentFix.lastDur = fixDur
      if (aoiBytes.length) this.currentFix.aoiBytes = aoiBytes
      return
    }
  }

  finalize(): void {
    // Flush a trailing lost-track run (recording ended while tracking was lost).
    if (this.invalidBuffer) {
      const sb = this.invalidBuffer.stimulusBytes
      if (sb) {
        this.emitSegment(
          this.invalidBuffer.start,
          this.invalidBuffer.end,
          this.resolveCategoryId(this.invalidNameBytes),
          sb,
          this.participantBytes,
          null
        )
      }
      this.invalidBuffer = null
    }
    if (this.blinkBuffer && this.blinkTerminated) {
      const buf = this.blinkBuffer
      this.blinkBuffer = null
      this.blinkTerminated = false
      const stimBytes = this.currentFix.stimulusBytes
      if (stimBytes) {
        this.emitSegment(
          buf.start,
          buf.end,
          this.resolveCategoryId(this.blinkNameBytes),
          stimBytes,
          this.participantBytes,
          null
        )
      }
      return
    }
    if (this.state === 'Fixation') {
      this.emitFixation()
    }
    return
  }

  private emitFixation(): void {
    const stimBytes = this.currentFix.stimulusBytes
    if (!stimBytes) return
    const aoi = this.currentFix.aoiBytes ? [this.currentFix.aoiBytes] : null
    this.emitSegment(
      this.currentFix.start,
      this.currentFix.end,
      this.resolveCategoryId(this.fixationNameBytes),
      stimBytes,
      this.participantBytes,
      aoi
    )
  }
}
