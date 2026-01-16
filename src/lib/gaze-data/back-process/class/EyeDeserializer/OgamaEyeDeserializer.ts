import type { SingleDeserializerOutput } from '$lib/gaze-data/back-process/types/SingleDeserializerOutput.js'
import { AbstractEyeDeserializer } from './AbstractEyeDeserializer'

export class OgamaEyeDeserializer extends AbstractEyeDeserializer {
  stimulusName: string
  cParticipant: number
  cSegments: number

  private readonly pParticipant = 0
  private readonly pSegments = 1

  constructor(header: string[], fileName: string, columnDelimiter: string) {
    super(columnDelimiter)
    // extract name from file name (SimilarityXXX.txt) where XXX is the stimulus name
    // this.stimulusName = fileName.split('.')[0].split('Similarity')[1]
    this.stimulusName = fileName.split('.')[0]
    this.cParticipant = this.getIndex(header, 'Sequence Similarity')
    this.cSegments = this.getIndex(header, 'Scanpath string')

    this.setupColumns([this.cParticipant, this.cSegments])
  }

  finalize(): null {
    return null
  }

  deserialize(_rawRowRef: string): SingleDeserializerOutput[] {
    const segments = this.getCurr(this.pSegments) // just letters - each one fixation
    const participant = this.getCurr(this.pParticipant)
    if (segments === undefined) return []
    const result: SingleDeserializerOutput[] = []
    for (let i = 0; i < segments.length; i++) {
      const aoi = segments[i] === '#' ? null : [segments[i]]
      const start = i.toString()
      const end = (i + 1).toString()
      const category = 'Fixation'
      const stimulus = this.stimulusName
      result.push({ aoi, category, end, participant, start, stimulus })
    }
    return result
  }
}
