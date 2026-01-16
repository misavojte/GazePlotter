import type { DeserializerOutputType } from '$lib/gaze-data/back-process/types/DeserializerOutputType'
import { AbstractEyeDeserializer } from './AbstractEyeDeserializer'

/**
 * This class is used to deserialize eye data from a CSV file which contains segments.
 * That means it has information about the start and end of each segment.
 */
export class CsvSegmentedFromToEyeDeserializer extends AbstractEyeDeserializer {
  cFrom: number
  cTo: number
  cParticipant: number
  cStimulus: number
  cAoi: number

  private readonly pFrom = 0
  private readonly pTo = 1
  private readonly pAoi = 2
  private readonly pParticipant = 3
  private readonly pStimulus = 4

  constructor(header: string[], columnDelimiter: string) {
    super(columnDelimiter)
    this.cFrom = this.getIndex(header, 'From')
    this.cTo = this.getIndex(header, 'To')
    this.cAoi = this.getIndex(header, 'AOI')
    this.cParticipant = this.getIndex(header, 'Participant')
    this.cStimulus = this.getIndex(header, 'Stimulus')

    this.setupColumns([
      this.cFrom,
      this.cTo,
      this.cAoi,
      this.cParticipant,
      this.cStimulus,
    ])
  }

  /**
   * Deserializes a single row from a CSV file into a DeserializerOutputType object.
   * This function checks the validity of required fields in the row. It does not store
   * any data in memory beyond the scope of this function.
   *
   * Note: This deserializer assumes all constants represent fixations, which may be subject to change.
   *
   * @param {string[]} row - An array representing a single row from the CSV file.
   *                         Expected to contain values for 'from', 'to', 'aoi', 'participant', and 'stimulus'.
   * @returns {DeserializerOutputType | null} - Returns an object containing deserialized data
   *                                            if the row is valid. If any required field ('from', 'to',
   *                                            'participant', 'stimulus') is empty, returns null.
   */
  deserialize(_rawRowRef: string): DeserializerOutputType {
    const from = this.getCurr(this.pFrom)
    const to = this.getCurr(this.pTo)
    const aoi = this.getCurr(this.pAoi)
    const participant = this.getCurr(this.pParticipant)
    const stimulus = this.getCurr(this.pStimulus)

    if (from === '' || to === '' || participant === '' || stimulus === '') {
      return null
    }

    return {
      aoi: aoi === '' ? null : [aoi],
      category: 'Fixation', // Not really, but for now let's assume that all the const is fixations
      start: from,
      end: to,
      participant: participant,
      stimulus: stimulus,
    }
  }

  /**
   * @returns null because this deserializer does not need to finalize anything
   */
  finalize(): DeserializerOutputType {
    return null
  }
}
