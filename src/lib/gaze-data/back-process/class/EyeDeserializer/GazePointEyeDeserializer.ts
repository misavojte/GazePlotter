import type { SingleDeserializerOutput } from '$lib/gaze-data/back-process/types/SingleDeserializerOutput.js'
import { AbstractEyeDeserializer } from './AbstractEyeDeserializer'

/**
 * GazePointEyeDeserializer streams raw GazePoint CSV rows into
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
 *  const des = new GazePointEyeDeserializer(header, fileName);
 *  for (const row of rows) {
 *    const evt = des.deserialize(row);
 *    if (evt) handle(evt);
 *  }
 *  const last = des.finalize(); if (last) handle(last);
 */
export class GazePointEyeDeserializer extends AbstractEyeDeserializer {
  private idx = {
    time: -1,
    start: -1,
    fixDur: -1,
    blinkId: -1,
    blinkDur: -1,
    aoi: -1,
    stim: -1,
    id: -1,
  }
  private state: 'Idle' | 'Fixation' = 'Idle'
  private currentFix = {
    fixID: '',
    stimulus: '',
    aoi: null as string | null,
    start: 0,
    end: 0,
    lastDur: 0,
  }
  private blinkBuffer: { start: number; end: number } | null = null
  private blinkTerminated = false
  private prevFixID: string | null = null
  private prevFixDur: number = 0
  private participant: string

  // Packed columns (strings)
  private readonly pTime = 0
  private readonly pStart = 1
  private readonly pFixDur = 2
  private readonly pBlinkId = 3
  private readonly pBlinkDur = 4
  private readonly pAoi = 5
  private readonly pStim = 6
  private readonly pId = 7

  constructor(header: string[], fileName: string, columnDelimiter: string) {
    super(columnDelimiter)
    const find = (pat: RegExp) => header.findIndex(h => pat.test(h))
    this.idx.time = find(/^TIME/) >= 0 ? find(/^TIME/) : header.indexOf('TIME')
    this.idx.start = header.indexOf('FPOGS')
    this.idx.fixDur = header.indexOf('FPOGD')
    this.idx.blinkId = header.indexOf('BKID')
    this.idx.blinkDur = header.indexOf('BKDUR')
    this.idx.aoi = header.indexOf('AOI')
    this.idx.stim = header.indexOf('MEDIA_NAME')
    this.idx.id = header.indexOf('FPOGID')
    this.participant = fileName.split('_')[0]

    this.setupColumns([
      this.idx.time,
      this.idx.start,
      this.idx.fixDur,
      this.idx.blinkId,
      this.idx.blinkDur,
      this.idx.aoi,
      this.idx.stim,
      this.idx.id,
    ])
  }

  deserialize(_rawRowRef: string): SingleDeserializerOutput | null {
    const time = parseFloat(this.getCurr(this.pTime))
    const startRaw = parseFloat(this.getCurr(this.pStart))
    const durFix = parseFloat(this.getCurr(this.pFixDur)) || 0
    const blinkId = parseInt(this.getCurr(this.pBlinkId), 10) || 0
    const blinkDur = parseFloat(this.getCurr(this.pBlinkDur)) || 0

    if (!Number.isFinite(time) || !Number.isFinite(startRaw)) return null

    const aoi = this.getCurr(this.pAoi) || null
    const fixID = this.getCurr(this.pId)
    const stim = this.getCurr(this.pStim)

    // 1) Blink detection
    if (blinkId > 0) {
      this.blinkBuffer = { start: time - blinkDur, end: time }
      this.blinkTerminated = false
      if (this.state === 'Fixation') {
        const f = this.emitFixation()
        this.state = 'Idle'
        return f
      }
      return null
    }
    if (this.blinkBuffer) {
      if (!this.blinkTerminated) {
        this.blinkBuffer.end = time
        this.blinkTerminated = true
        return null
      }
      const blinkEvent: SingleDeserializerOutput = {
        participant: this.participant,
        stimulus: this.currentFix.stimulus,
        category: 'Blink',
        start: String(this.blinkBuffer.start),
        end: String(this.blinkBuffer.end),
        aoi: null,
      }
      this.blinkBuffer = null
      this.blinkTerminated = false
      return blinkEvent
    }

    // 2) Fixation handling
    const isFix = durFix > 0

    if (this.state === 'Idle') {
      // Prevent restarting identical segment
      if (isFix && (fixID !== this.prevFixID || durFix > this.prevFixDur)) {
        this.currentFix = {
          fixID,
          stimulus: stim,
          aoi,
          start: startRaw,
          end: time,
          lastDur: durFix,
        }
        this.state = 'Fixation'
      }
      return null
    }

    // state: Fixation
    {
      const idChanged = fixID !== this.currentFix.fixID
      const stimChanged = stim !== this.currentFix.stimulus
      const durFallen = durFix <= this.currentFix.lastDur
      const needFlush = !isFix || idChanged || stimChanged || durFallen
      if (needFlush) {
        const out = this.emitFixation()
        this.state = 'Idle'
        // store previous
        this.prevFixID = out.participant ? this.currentFix.fixID : null
        this.prevFixDur = this.currentFix.lastDur
        // possibly start next fixation
        if (isFix && (fixID !== this.prevFixID || durFix > this.prevFixDur)) {
          this.currentFix = {
            fixID,
            stimulus: stim,
            aoi,
            start: startRaw,
            end: time,
            lastDur: durFix,
          }
          this.state = 'Fixation'
        }
        return out
      }
      // continue
      this.currentFix.end = time
      this.currentFix.lastDur = durFix
      if (aoi) this.currentFix.aoi = aoi
      return null
    }
  }

  finalize(): SingleDeserializerOutput | null {
    if (this.blinkBuffer && this.blinkTerminated) {
      const buf = this.blinkBuffer
      this.blinkBuffer = null
      this.blinkTerminated = false
      const out: SingleDeserializerOutput = {
        participant: this.participant,
        stimulus: this.currentFix.stimulus,
        category: 'Blink',
        start: String(buf.start),
        end: String(buf.end),
        aoi: null,
      }
      return out
    }
    if (this.state === 'Fixation') {
      const out = this.emitFixation()
      return out
    }
    return null
  }

  private emitFixation(): SingleDeserializerOutput {
    const out: SingleDeserializerOutput = {
      participant: this.participant,
      stimulus: this.currentFix.stimulus,
      category: 'Fixation',
      start: String(this.currentFix.start),
      end: String(this.currentFix.end),
      aoi: this.currentFix.aoi ? [this.currentFix.aoi] : null,
    }
    return out
  }
}
