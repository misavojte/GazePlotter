import type { SingleDeserializerOutput } from '$lib/type/DeserializerOutput/SingleDeserializerOutput/SingleDeserializerOutput.js'
import { AbstractEyeDeserializer } from './AbstractEyeDeserializer.ts'

export class BeGazeEyeDeserializer extends AbstractEyeDeserializer {
  cStart: number
  cEnd: number
  cStimulus: number
  cParticipant: number
  cCategory: number
  cAoi: number
  constructor (header: string[]) {
    super()
    this.cStart = this.getIndex(header, 'Event Start Trial Time [ms]')
    this.cEnd = this.getIndex(header, 'Event End Trial Time [ms]')
    this.cStimulus = this.getIndex(header, 'Stimulus')
    this.cParticipant = this.getIndex(header, 'Participant')
    this.cCategory = this.getIndex(header, 'Category')
    this.cAoi = this.getIndex(header, 'AOI Name')
  }

  deserialize (row: string[]): SingleDeserializerOutput | null {
    const start = row[this.cStart]
    const end = row[this.cEnd]
    const stimulus = row[this.cStimulus]
    const participant = row[this.cParticipant]
    const category = row[this.cCategory]
    const aoi = row[this.cAoi]

    if (this.isNan(start) || this.isNan(end)) return null
    if (this.isInvalidCategory(category)) return null

    const transformedAoi = this.transformAoi(aoi)

    return { aoi: transformedAoi, category, end, participant, start, stimulus }
  }

  finalize (): null {
    return null
  }

  isNan (value: string): boolean {
    return isNaN(Number(value))
  }

  isInvalidCategory (category: string): boolean {
    return category === 'Separator'
  }

  transformAoi (aoi: string | null): string[] | null {
    if (aoi === '-' || aoi === 'White Space' || aoi === null) return null
    return [aoi]
  }
}
