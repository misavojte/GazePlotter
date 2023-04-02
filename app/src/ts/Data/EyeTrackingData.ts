export interface ETDInterface {
  isOrdinalOnly: boolean
  aois: ETDAois
  categories: ETDBaseAttributeHolder
  participants: ETDBaseAttributeHolder
  stimuli: ETDBaseAttributeHolder
  segments: number[][][][]
}

interface ETDAois {
  data: string[][][]
  orderVector: number[][] | []
  dynamicVisibility: AoiVisibility
}

/**
 * An object that represents the visibility blocks for AOIs.
 *
 * The object has string keys in the form of AAAxBBBxCCC, where AAA is the stimulusId, BBB is the aoiId,
 * and CCC is the participantId.
 *
 * The associated value is an array of numbers representing the visibility blocks for the AOI.
 * Each pair of consecutive numbers in the array represents the start and end values of a visibility block for the AOI.
 * The length of the array must be even, and each pair of consecutive numbers must represent a valid visibility block for the AOI.
 *
 * @example
 * const myAoiVisibility: AoiVisibility = {
 *   '001_002_003': [0, 100, 104, 120],
 *   '004_005_006': [10, 20, 30, 40, 50, 60],
 * };
 */
interface AoiVisibility {
  [key: string]: number[]
}

interface ETDBaseAttributeHolder {
  data: string[][]
  orderVector: number[] | []
}

export class EyeTrackingData {
  private readonly DEFAULT_COLORS: string[] = ['#66c5cc', '#f6cf71', '#f89c74', '#dcb0f2', '#87c55f', '#9eb9f3', '#fe88b1', '#c9db74', '#8be0a4', '#b497e7', '#d3b484', '#b3b3b3']
  main: ETDInterface

  constructor (main: ETDInterface) {
    this.main = main
    // console.log(this.main)
    // console.log(JSON.stringify(this.main))
  }

  get noOfStimuli (): number {
    return this.main.stimuli.data.length
  }

  getStimulInfo (stimulusIndex: number): Object {
    return {
      originalName: this.getStimulOriginalName(stimulusIndex),
      displayedName: this.getStimulDisplayedName(stimulusIndex),
      highestEndTime: this.getStimulHighestEndTime(stimulusIndex)
    }
  }

  getStimulDisplayedName (stimulusIndex: number): string {
    const stimulArr = this.main.stimuli.data[stimulusIndex]
    if (stimulArr === undefined) throw new Error()
    return stimulArr[1] ?? stimulArr[0]
  }

  getStimulOriginalName (stimulusIndex: number): string {
    const stimulArr = this.main.stimuli.data[stimulusIndex]
    if (stimulArr === undefined) throw new Error()
    return stimulArr[0]
  }

  getStimulHighestEndTime (stimulusIndex: number): number {
    let max = 0
    for (let participantIndex = 0; participantIndex < this.noOfParticipants; participantIndex++) {
      const lastSegmentEndTime = this.getParticEndTime(stimulusIndex, participantIndex)
      max = lastSegmentEndTime > max ? max = lastSegmentEndTime : max
    }
    return max
  }

  // particip getter

  getParticName (particIndex: number): string {
    const particArr = this.main.participants.data[particIndex]
    return particArr[1] ?? particArr[0]
  }

  getParticOriginalName (particIndex: number): string {
    return this.main.participants.data[particIndex][0]
  }

  getParticEndTime (stimulusIndex: number, particIndex: number): number {
    const segmentsInfo = this.main.segments[stimulusIndex][particIndex]
    return segmentsInfo === undefined ? 0 : segmentsInfo.length > 0 ? segmentsInfo[segmentsInfo.length - 1][1] : 0
  }

  getParticInfo (stimulusIndex: number, particIndex: number): Object {
    return {
      displayedName: this.getParticName(particIndex),
      orginalName: this.getParticOriginalName(particIndex),
      endTime: this.getParticEndTime(stimulusIndex, particIndex)
    }
  }

  // aois getters
  getAoiInfo (stimulusId: number, aoiId: number): { aoiId: number, originalName: string, displayedName: string, color: string } {
    const aoiArr = this.main.aois.data[stimulusId][aoiId]
    const originalName = aoiArr[0]
    const displayedName = aoiArr[1] ?? originalName
    const color = aoiArr[2] ?? this.DEFAULT_COLORS[aoiId]
    return { aoiId, originalName, displayedName, color }
  }

  getCatInfo (categoryId: number): { originalName: string, displayedName: string } {
    const catArr = this.main.categories.data[categoryId]
    const originalName = catArr[0]
    const displayedName = catArr[1] ?? catArr[0]
    return { originalName, displayedName }
  }

  // seg getter
  getSegmentInfo (stimulusId: number, participantId: number, segmentId: number): {
    start: number
    end: number
    category: number
    aoi: number[]
  } {
    const segmentArr = this.main.segments[stimulusId][participantId]?.[segmentId]
    if (segmentArr === undefined) throw new Error()
    const start = segmentArr[0]
    const end = segmentArr[1]
    const category = segmentArr[2]
    const aoi = this.orderAoisIdsByOrderVector(stimulusId, segmentArr.slice(3))
    return { start, end, category, aoi }
  }

  orderAoisIdsByOrderVector (stimulusId: number, aoiIds: number[]): number[] {
    const orderVector = this.main.aois.orderVector?.[stimulusId]
    if (orderVector == null) return aoiIds
    return aoiIds.sort((a, b) => orderVector.indexOf(a) - orderVector.indexOf(b))
  }

  getNoOfSegments (stimulusId: number, participantId: number): number {
    return this.main.segments[stimulusId]?.[participantId]?.length ?? 0
  }

  getAoiOrderArray (stimulusIndex: number): number[] {
    const order = this.main.aois.orderVector?.[stimulusIndex]
    // if it does not exist in data, return array of sequence from 0 to N
    // N ... number of aoi categories for given stimulus
    if (order == null) {
      const noOfAois = this.main.aois.data[stimulusIndex].length
      return [...Array(noOfAois).keys()]
    }
    return order
  }

  get noOfParticipants (): number {
    return this.main.participants.data.length
  }

  setAoiColor (stimulusId: number, aoiId: number, color: string): void {
    if (this.getAoiInfo(stimulusId, aoiId).color !== color) {
      this.main.aois.data[stimulusId][aoiId][2] = color
    }
  }

  setAoiName (stimulusId: number, aoiId: number, name: string): void {
    if (this.getAoiInfo(stimulusId, aoiId).displayedName !== name) {
      this.main.aois.data[stimulusId][aoiId][1] = name
    }
  }

  setAoiOrder (stimulusId: number, order: number[]): void {
    if (this.getAoiOrderArray(stimulusId) !== order) {
      this.main.aois.orderVector[stimulusId] = order
    }
  }

  addAoiVis (stimulusId: number, aoiName: string, visibilityArr: number[], participantId: number | null = null): boolean {
    const aoiData = this.main.aois.data[stimulusId]
    const aoiId = aoiData.findIndex(el => el[0] === aoiName)
    let key = `${stimulusId}_${aoiId}`
    if (participantId != null) key += `_${participantId}`
    if (aoiId > -1) {
      this.main.aois.dynamicVisibility[key] = visibilityArr
      return true
    }
    return false
  }

  getAoiVis (stimulusId: number, aoiId: number, participantId: number | null = null): number[] | null {
    const baseKey = `${stimulusId}_${aoiId}`
    let result = this.main.aois.dynamicVisibility[baseKey] ?? null
    if (participantId != null) {
      const extendedKey = `${baseKey}_${participantId}`
      result = this.main.aois.dynamicVisibility[extendedKey] ?? result
    }
    return result
  }
}
