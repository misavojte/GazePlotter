import { EyeTrackingData } from '../../Data/EyeTrackingData'
import {
  AxisBreaks,
  ScarfFilling,
  ScarfParticipant,
  ScarfSegment,
  ScarfSegmentContent,
  ScarfStimuliInfo,
  ScarfStyling,
  ScarfStylingList
} from './ScarfModel'
import { ScarfSettingsType } from '../../Types/Scarf/ScarfSettingsType'

export class ScarfService {
  IDENTIFIER_IS_AOI: string = 'a'
  IDENTIFIER_IS_OTHER_CATEGORY: string = 'ac'
  IDENTIFIER_NOT_DEFINED: string = 'N'
  HEIGHT_OF_X_AXIS: number = 20

  // todo move to settings
  showTheseSegmentCategories: number[] = [0, 1]
  heightOfBar: number = 20
  heightOfBarWrap: number = 30
  heightOfNonFixation: number = 4
  stimulusId: number
  data: EyeTrackingData
  spaceAboveRect: number
  aoiOrderedArr: number[]
  participants: ScarfParticipant[]
  timeline: AxisBreaks
  stimuli: ScarfStimuliInfo[]
  stylingAndLegend: ScarfStylingList
  chartHeight: number
  settings: ScarfSettingsType

  constructor (stimulusId: number, participantIds: number[], axis: AxisBreaks, data: EyeTrackingData, settings: ScarfSettingsType, participGap: number = 10) {
    this.stimulusId = stimulusId
    this.settings = settings
    this.data = data
    this.spaceAboveRect = participGap / 2
    this.aoiOrderedArr = data.getAoiOrderArray(stimulusId)
    this.timeline = axis
    const participants = []
    for (let i = 0; i < participantIds.length; i++) {
      const participant = this.#prepareParticipant(participantIds[i])
      if (participant !== null) participants.push(participant)
    }
    this.participants = participants
    this.chartHeight = (participants.length * this.heightOfBarWrap) + this.HEIGHT_OF_X_AXIS
    this.stimuli = this.#prepareStimuliList()
    this.stylingAndLegend = this.#prepareStylingAndLegend()
  }

  getViewFilling (): ScarfFilling {
    return {
      barHeight: this.heightOfBar,
      stimulusId: this.stimulusId,
      heightOfBarWrap: this.heightOfBarWrap,
      chartHeight: this.chartHeight,
      stimuli: this.stimuli,
      participants: this.participants,
      timeline: this.timeline,
      stylingAndLegend: this.stylingAndLegend
    }
  }

  // todo nová helper class?
  #prepareStimuliList (): ScarfStimuliInfo[] {
    const iterateTo = this.data.main.stimuli.data.length
    const response = []
    for (let i = 0; i < iterateTo; i++) {
      const stimulusInfo: ScarfStimuliInfo = { id: i, name: this.data.getStimulDisplayedName(i) }
      response.push(stimulusInfo)
    }
    return response
  }

  #prepareStylingAndLegend (): ScarfStylingList {
    const iterateTo = this.aoiOrderedArr.length
    const aoi = []
    for (let i = 0; i < iterateTo; i++) {
      const currentAoiIndex = this.aoiOrderedArr[i]
      const aoiInfo = this.data.getAoiInfo(this.stimulusId, currentAoiIndex)
      const stylingBaseAoi: ScarfStyling = {
        identifier: `${this.IDENTIFIER_IS_AOI}${aoiInfo.aoiId}`,
        name: aoiInfo.displayedName,
        color: aoiInfo.color,
        height: this.heightOfBar
      }
      aoi.push(stylingBaseAoi)
    }

    const stylingFixationButNoAoi: ScarfStyling = {
      identifier: `${this.IDENTIFIER_IS_AOI}${this.IDENTIFIER_NOT_DEFINED}`,
      name: 'No AOI hit',
      color: '#a6a6a6',
      height: this.heightOfBar
    }
    aoi.push(stylingFixationButNoAoi)
    // TODO PŘEDĚLAT
    // for (let i = 1; i < this.showTheseSegmentCategories.length; i++) {
    //
    //
    // }
    const stylingSaccade: ScarfStyling = {
      identifier: `${this.IDENTIFIER_IS_OTHER_CATEGORY}${1}`,
      name: 'Saccade',
      color: '#555555',
      height: this.heightOfNonFixation
    }
    const stylingOther: ScarfStyling = {
      identifier: `${this.IDENTIFIER_IS_OTHER_CATEGORY}${this.IDENTIFIER_NOT_DEFINED}`,
      name: 'Other',
      color: '#a6a6a6',
      height: this.heightOfNonFixation
    }
    const category = []
    category.push(stylingSaccade)
    category.push(stylingOther)

    return {
      visibility: [],
      aoi,
      category
    }
  }

  #prepareParticipant (id: number): ScarfParticipant {
    const iterateTo = this.data.getNoOfSegments(this.stimulusId, id)
    const sessionDuration = this.data.getParticEndTime(this.stimulusId, id)
    const label = this.data.getParticName(id)
    const width = this.settings.timeline === 'relative' ? '100%' : `${(sessionDuration / this.timeline.maxLabel) * 100}%`
    const segments = []
    for (let i = 0; i < iterateTo; i++) {
      segments.push(this.#prepareSegment(id, i, sessionDuration))
    }

    // TODO napravit height
    // ?? dafak :D
    return { aoiVisibility: [], id, label, segments, width }
  }

  /**
   *
   * @param {int} participantId
   * @param {int} segmentId
   * @param sessionDuration total session duration [ms] for given participant
   */
  #prepareSegment (participantId: number, segmentId: number, sessionDuration: number): ScarfSegment {
    const segment = this.data.getSegmentInfo(this.stimulusId, participantId, segmentId)
    const isOrdinal = this.settings.timeline === 'ordinal'
    const start = isOrdinal ? segmentId : segment.start
    const end = isOrdinal ? segmentId + 1 : segment.end
    const x = `${(start / sessionDuration) * 100}%`
    const width = `${((end - start) / sessionDuration) * 100}%`
    return { content: this.#prepareSegmentContents(segment, x, width) }
  }

  #prepareSegmentContents (segment: { start: number, end: number, category: number, aoi: number[] }, x: string, width: string): ScarfSegmentContent[] {
    let aoiOrNotIdentifier = this.IDENTIFIER_IS_AOI
    let typeDistinctionIdentifier = this.IDENTIFIER_NOT_DEFINED

    const getIdentifier = (): string => {
      return aoiOrNotIdentifier + typeDistinctionIdentifier
    }

    if (segment.category !== 0) {
      const height = this.heightOfNonFixation
      const y = this.spaceAboveRect + this.heightOfBar / 2 - height / 2

      aoiOrNotIdentifier = this.IDENTIFIER_IS_OTHER_CATEGORY

      if (this.showTheseSegmentCategories.includes(segment.category)) typeDistinctionIdentifier = segment.category.toString()

      const nonFixationSegmentContent: ScarfSegmentContent = {
        x, y, width, height, identifier: getIdentifier()
      }
      return [nonFixationSegmentContent]
    }

    if (segment.aoi.length === 0) {
      const fixationWithoutAoiContent: ScarfSegmentContent = {
        x, y: this.spaceAboveRect, width, height: this.heightOfBar, identifier: getIdentifier()
      }
      return [fixationWithoutAoiContent]
    }

    const height = this.heightOfBar / segment.aoi.length
    let yOfOneContent = this.spaceAboveRect
    const result = []
    // going through all possible AOI categories in the selected stimulus
    // to ensure AOIs are ordered as specified by order array
    for (let aoiIndex = 0; aoiIndex < this.aoiOrderedArr.length; aoiIndex++) {
      const aoiId = this.aoiOrderedArr[aoiIndex]
      // coercing to string - otherwise would be always false!
      if (segment.aoi.includes(aoiId)) {
        typeDistinctionIdentifier = aoiId.toString()
        const fixationWithAoiContent: ScarfSegmentContent = {
          x, y: yOfOneContent, width, height, identifier: getIdentifier()
        }
        result.push(fixationWithAoiContent)
        yOfOneContent += height
      }
    }
    return result
  }
}
