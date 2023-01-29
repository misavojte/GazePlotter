import { AbstractModel } from '../Common/AbstractModel'
import { EyeTrackingData } from '../../Data/EyeTrackingData'
import { ScarfTooltipView } from '../ScarfTooltip/ScarfTooltipView'
import { ScarfTooltipController } from '../ScarfTooltip/ScarfTooltipController'
import { ScarfTooltipModel } from '../ScarfTooltip/ScarfTooltipModel'
import { WorkplaceModel } from '../Workplace/WorkplaceModel'

/**
 * Model for scarf plot (sequence chart) showing eye-tracking segments for given stimuli and participants.
 * @param data - EyeTrackingData object containing all data related to eye-tracking survey (see Data/EyeTrackingData.ts)
 * @param stimulusId - ID of the stimulus to be plotted
 * @param isAbsoluteTimeline - boolean indicating whether the timeline is absolute or relative
 * @param zoomFrom - number [%] indicating value to start zooming animation from (always >= 100)
 * @param zoomTo - number [%] indicating value to end zooming animation at (always >= 100)
 * @extends AbstractModel
 */
export class ScarfModel extends AbstractModel {
  scarfId: number = 0
  data: EyeTrackingData
  stimulusId: number
  isTimelineRelative: boolean = false
  isDetached: boolean = true
  zoomFrom: number = 100
  zoomTo: number = 100
  tooltipComponent: ScarfTooltipView
  absoluteTimeline: AxisBreaks
  highlightedType: string | null = null
  isRequestingModal: boolean = false

  constructor (workplace: WorkplaceModel, stimulusId: number = 0) {
    super()
    this.addObserver(workplace)
    const data = workplace.data
    if (data === null) throw new Error('ScarfModel.constructor() - workplace.data is null')
    this.data = data
    this.tooltipComponent = new ScarfTooltipView(new ScarfTooltipController(new ScarfTooltipModel(data)))
    this.stimulusId = stimulusId
    this.isTimelineRelative = false
    this.absoluteTimeline = new AxisBreaks(this.data.getStimulHighestEndTime(stimulusId))
  }

  fireNewStimulus (stimulusId: number): void {
    this.stimulusId = stimulusId
    this.absoluteTimeline = new AxisBreaks(this.data.getStimulHighestEndTime(stimulusId))
    this.tooltipComponent.controller.model.stimulusId = stimulusId
    this.redraw()
  }

  redraw (): void {
    this.isTimelineRelative = false
    this.notify('stimulus', ['scarf-view'])
  }

  getData (): ScarfFilling {
    const data = this.data
    return new ScarfModelFillingFactory(this.stimulusId, data).getViewFilling()
  }

  getTimelineUnit (): string {
    return this.isTimelineRelative ? '%' : 'ms'
  }

  getParticipantAbsoluteWidth (participantId: number): string {
    return `${(this.data.getParticEndTime(this.stimulusId, participantId) / this.absoluteTimeline.maxLabel) * 100}%`
  }

  getParticipantToWidth (participantId: number): string {
    return this.isTimelineRelative ? '100%' : this.getParticipantAbsoluteWidth(participantId)
  }

  getParticipantFromWidth (participantId: number): string {
    return this.isTimelineRelative ? this.getParticipantAbsoluteWidth(participantId) : '100%'
  }

  getPatternWidth (): string {
    return this.isTimelineRelative ? '10%' : `${(this.absoluteTimeline[1] / this.absoluteTimeline.maxLabel) * 100}%`
  }

  getTimeline (): AxisBreaks {
    return this.isTimelineRelative ? new AxisBreaks(100) : this.absoluteTimeline
  }

  fireZoom (isZoomIn: boolean): void {
    const newZoomFrom = this.zoomTo
    if (newZoomFrom <= 100 && !isZoomIn) return
    this.zoomTo = isZoomIn ? newZoomFrom * 2 : newZoomFrom / 2
    this.zoomFrom = newZoomFrom
    this.notify('zoom', [])
  }

  fireTimelineChange (): void {
    this.isTimelineRelative = !this.isTimelineRelative
    this.notify('timeline', ['scarf-view'])
  }

  fireHighlight (identifier: string | null): void {
    this.highlightedType = identifier
    this.notify('highlight', ['scarf-view'])
  }

  fireOpenSettings (): void {
    this.isRequestingModal = true
    this.notify('open-scarf-settings-modal', ['workplaceModel'])
  }

  fireOpenAoiSettings (): void {
    this.isRequestingModal = true
    this.notify('open-aoi-settings-modal', ['workplaceModel'])
  }

  fireDownload (): void {
    this.isRequestingModal = true
    this.notify('open-scarf-download-modal', ['workplaceModel'])
  }
}

class ScarfModelFillingFactory {
  IDENTIFIER_IS_AOI: string = 'a'
  IDENTIFIER_IS_OTHER_CATEGORY: string = 'ac'
  IDENTIFIER_NOT_DEFINED: string = 'N'

  HEIGHT_OF_X_AXIS: number = 20

  // todo move to settings
  showTheseSegmentCategories: number[] = [0, 1]
  heightOfBar: number = 20
  heightOfBarWrap: number = 30
  heightOfNonFixation: number = 4
  //

  stimulusId: number
  data: EyeTrackingData
  spaceAboveRect: number
  aoiOrderedArr: number[]
  participants: ScarfParticipant[]
  timeline: AxisBreaks
  stimuli: ScarfStimuliInfo[]
  stylingAndLegend: ScarfStylingList
  chartHeight: number

  constructor (stimulusId: number, data: EyeTrackingData, participGap: number = 10) {
    this.stimulusId = stimulusId
    this.data = data
    this.spaceAboveRect = participGap / 2
    this.aoiOrderedArr = data.getAoiOrderArray(stimulusId)
    this.participants = []
    const participantsCount = this.data.noOfParticipants
    const highestEndTime = this.getHighestEndTime(participantsCount)
    this.timeline = new AxisBreaks(highestEndTime)
    for (let i = 0; i < participantsCount; i++) {
      const participant = this.#prepareParticipant(i)
      if (participant !== null) this.participants.push(participant)
    }
    const participantsCountAfterFilter = this.participants.length
    this.chartHeight = (participantsCountAfterFilter * this.heightOfBarWrap) + this.HEIGHT_OF_X_AXIS
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

  getHighestEndTime (participantsCount: number): number {
    let highestEndTime = 0
    for (let i = 0; i < participantsCount; i++) {
      const numberOfSegments = this.data.getNoOfSegments(this.stimulusId, i)
      if (numberOfSegments === 0) continue
      const currentEndTime = this.data.getParticEndTime(this.stimulusId, i)
      if (currentEndTime > highestEndTime) highestEndTime = currentEndTime
    }
    return highestEndTime
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

  #prepareParticipant (id: number): ScarfParticipant | null {
    // todo připravit na řazení
    const iterateTo = this.data.getNoOfSegments(this.stimulusId, id)
    if (iterateTo === 0) return null
    const sessionDuration = this.data.getParticEndTime(this.stimulusId, id)
    const label = this.data.getParticName(id)
    const width = `${(sessionDuration / this.timeline.maxLabel) * 100}%`

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
    const x = `${(segment.start / sessionDuration) * 100}%`
    const width = `${((segment.end - segment.start) / sessionDuration) * 100}%`
    return { content: this.#prepareSegmentContents(segment, x, width) }
  }

  #prepareSegmentContents (segment: { start: number, end: number, category: number, aoi: number[] }, x: string, width: string): ScarfSegmentContent[] {
    let aoiOrNotIdentifier = this.IDENTIFIER_IS_AOI
    let typeDistinctionIdentifier = this.IDENTIFIER_NOT_DEFINED

    const getIdentifier = (): string => { return aoiOrNotIdentifier + typeDistinctionIdentifier }

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

export interface ScarfFilling {
  stimulusId: number
  timeline: AxisBreaks
  stylingAndLegend: ScarfStylingList
  barHeight: number
  heightOfBarWrap: number
  chartHeight: number
  participants: ScarfParticipant[]
  stimuli: ScarfStimuliInfo[]
}

export interface ScarfStimuliInfo {
  id: number
  name: string
}

export interface ScarfStylingList {
  aoi: ScarfStyling[]
  category: ScarfStyling[]
  visibility: ScarfStyling[]
}

export interface ScarfStyling {
  name: string
  identifier: string
  color: string
  height: number
}

export interface ScarfParticipant {
  id: number
  label: string
  width: string // in %!
  segments: ScarfSegment[]
  aoiVisibility: [] // not applied
}

export interface ScarfSegment {
  content: ScarfSegmentContent[]
}

export interface ScarfSegmentContent {
  x: string // with %
  width: string // with %
  y: number
  height: number
  identifier: string
}

export class AxisBreaks extends Array {
  constructor (numberToBreak: number, numberOfSteps: number = 10) {
    const { step, length } = AxisBreaks.getSteps(numberToBreak, numberOfSteps)
    super(length)
    for (let i = 0; i < length; i++) this[i] = step * i
  }

  get maxLabel (): number {
    return this[this.length - 1]
  }

  static getSteps (numberToBreak: number, numberOfSteps: number): { step: number, length: number } {
    const step = AxisBreaks.getStep(numberToBreak, numberOfSteps)
    while (step === AxisBreaks.getStep(numberToBreak, numberOfSteps - 1)) {
      numberOfSteps--
    }
    return { step, length: numberOfSteps + 1 }
  }

  static getStep (numberToBreak: number, numberOfSteps: number): number {
    let res = numberToBreak / numberOfSteps
    const numOfDigits = (Math.log(res) * Math.LOG10E + 1 | 0) - 1
    res = Math.ceil(res / (10 ** (numOfDigits)))
    if ((res % 2 === 1 && res % 5 > 0) && res !== 1) {
      res++
    }
    if (res % 6 === 0 || res % 8 === 0) {
      res = 10
    }
    return res * (10 ** (numOfDigits))
  }
}
