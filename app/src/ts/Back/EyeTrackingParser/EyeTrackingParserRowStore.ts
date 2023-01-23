import { ETDInterface } from '../../Data/EyeTrackingData'

/**
 * Ať žije legacy code.
 * Ať žijí špatná rozhodnutí minulých já.
 */
export class EyeTrackingParserRowStore {
  data: ETDInterface = {
    stimuli: { data: [], orderVector: [] },
    participants: { data: [], orderVector: [] },
    categories: { data: [['Fixation'], ['Saccade']], orderVector: [] },
    aois: { data: [], orderVector: [] },
    segments: []
  }

  add (row: { start: string, end: string, stimulus: string, participant: string, category: string, aoi: string[] | null }): void {
    const stimulusIndex = this.processStimulus(row.stimulus)
    const participantIndex = this.processParticipant(row.participant, stimulusIndex)
    const aoiIDs = this.processAOIs(row.aoi, stimulusIndex)
    const categoryID = this.processCategory(row.category)

    // generation of Segment info array:
    // 0: start time [ms], 1: end time [ms], 2: category ID, 3+: AOI ID(s)
    let segment = [Number(row.start), Number(row.end), categoryID]
    if (aoiIDs !== null) {
      segment = segment.concat(aoiIDs)
    }

    // check if the value is undefined
    // if yes, assign the value of an empty array to it
    this.data.segments[stimulusIndex][participantIndex] ??= []
    this.data.segments[stimulusIndex][participantIndex].push(segment)
  }

  processStimulus (sName: string): number {
    // check if Stimulus name (string) is already recorded in "data"
    // the original name is always saved to a new array object to index position 0
    const sData = this.data.stimuli.data // this could be dangerous
    let sIndex = sData.findIndex(el => el[0] === sName)

    if (sIndex === -1) {
      sIndex = sData.length
      sData.push([sName])
      this.data.aois.data.push([])
      this.data.segments.push([])
    }

    return sIndex
  }

  processParticipant (pName: string, sIndex: number): number {
    // check if Stimulus name (string) is already recorded in "data"
    // the original name is always saved to a new array object to index position 0
    const pData = this.data.participants.data
    let pIndex = pData.findIndex(el => el[0] === pName)

    if (pIndex === -1) {
      pIndex = pData.length
      pData.push([pName])
      this.data.segments[sIndex].push([])
    }

    return pIndex
  }

  processCategory (cName: string): number {
    const cData = this.data.categories.data
    let cIndex = cData.findIndex(el => el[0] === cName)
    if (cIndex === -1) {
      cIndex = cData.length
      cData.push([cName])
    }
    return cIndex
  }

  processAOIs (aNames: string[] | null, sIndex: number): null | number[] {
    if (aNames === null) return null
    const aois: number[] = []
    for (let i = 0; i < aNames.length; i++) {
      const aoi = this.processAOI(aNames[i], sIndex)
      if (aoi !== null) aois.push(aoi)
    }
    if (aois.length === 0) return null
    return aois
  }

  processAOI (aName: string | null, sIndex: number): null | number {
    // if no AOI, skip
    if (aName === null) return null

    // check if AOI name (single string!) is already recorded in "data"
    // the original name is always saved to a new array object to index position 0
    const aData = this.data.aois.data[sIndex]
    let aIndex = aData.findIndex(el => el[0] === aName)

    if (aIndex === -1) {
      aIndex = aData.length
      aData.push([aName + ''])
    }

    return aIndex // is array for cross-compatibility
  }
}
