import type { SingleDeserializerOutput } from '$lib/type/DeserializerOutput/SingleDeserializerOutput/SingleDeserializerOutput.js'
import { AbstractEyeDeserializer } from './AbstractEyeDeserializer.ts'

export class VarjoEyeDeserializer extends AbstractEyeDeserializer {
  cTime: number
  cActorLabel: number // ActorLabel stands for AOI
  mTimeStart: string = ''
  mTimeLast: string = ''
  mTimeBase: number | null = null
  mActorLabel: string | null = null
  mParticipant: string
  constructor (header: string[], fileName: string) {
    super()
    this.cTime = this.getIndex(header, 'Time')
    this.cActorLabel = this.getIndex(header, 'Actor Label')
    this.mParticipant = fileName.split('.')[0]
  }

  deserialize (row: string[]): SingleDeserializerOutput | null {
    const time = row[this.cTime]
    const actorLabel = row[this.cActorLabel]
    const isNewSegment = actorLabel !== this.mActorLabel

    let output: SingleDeserializerOutput | null = null

    if (this.mTimeBase === null) this.mTimeBase = this.convertStringTime(time) // at the beginning of the file, set the base time
    if (isNewSegment) {
      output = this.finalize()
      this.mTimeStart = time // if a new segment starts, set the start time
      this.mActorLabel = actorLabel
    }
    this.mTimeLast = time
    return output
  }

  finalize (): SingleDeserializerOutput | null {
    const baseTime = this.mTimeBase
    if (baseTime === null) throw new Error('Base time is null')
    const actorLabel = this.mActorLabel
    if (actorLabel === null) return null
    return {
      aoi: actorLabel === '' ? null : [actorLabel],
      category: 'Fixation', // Not really, but for now let's assume that all the const is fixations
      start: String(this.convertStringTime(this.mTimeStart) - baseTime),
      end: String(this.convertStringTime(this.mTimeLast) - baseTime),
      participant: this.mParticipant,
      stimulus: 'VarjoScene'
    }
  }

  convertStringTime (time: string): number {
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
