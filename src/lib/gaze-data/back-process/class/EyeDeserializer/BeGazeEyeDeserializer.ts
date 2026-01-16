import type { SingleDeserializerOutput } from '$lib/gaze-data/back-process/types/SingleDeserializerOutput'
import { AbstractEyeDeserializer } from './AbstractEyeDeserializer'

export class BeGazeEyeDeserializer extends AbstractEyeDeserializer {
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

  constructor(header: string[], columnDelimiter: string) {
    super(columnDelimiter)
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

  deserialize(_rawRowRef: string): SingleDeserializerOutput | null {
    const start = this.getCurr(this.pStart)
    const end = this.getCurr(this.pEnd)
    const stimulus = this.getCurr(this.pStimulus)
    const participant = this.getCurr(this.pParticipant)
    const category = this.getCurr(this.pCategory)
    const aoi = this.getCurr(this.pAoi)

    if (this.isNan(start) || this.isNan(end)) return null
    if (this.isInvalidCategory(category)) return null

    const transformedAoi = this.transformAoi(aoi)

    const out = {
      aoi: transformedAoi,
      category,
      end,
      participant,
      start,
      stimulus,
    }
    return out
  }

  finalize(): null {
    return null
  }

  isNan(value: string): boolean {
    return isNaN(Number(value))
  }

  isInvalidCategory(category: string): boolean {
    return category === 'Separator'
  }

  transformAoi(aoi: string | null): string[] | null {
    if (aoi === '-' || aoi === 'White Space' || aoi === null) return null
    return [aoi]
  }
}
