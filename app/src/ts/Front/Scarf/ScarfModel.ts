import { AbstractModel } from '../Common/AbstractModel'
import { EyeTrackingData } from '../../Data/EyeTrackingData'
import { ScarfTooltipView } from '../ScarfTooltip/ScarfTooltipView'
import { ScarfTooltipController } from '../ScarfTooltip/ScarfTooltipController'
import { ScarfTooltipModel } from '../ScarfTooltip/ScarfTooltipModel'
import { WorkplaceModel } from '../Workplace/WorkplaceModel'
import { ScarfService } from './ScarfService'
import { ScarfSettingsType } from '../../Types/Scarf/ScarfSettingsType'

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
  participantIds: number[]
  settings: ScarfSettingsType = {
    aoiVisibility: false,
    ordinalTimeline: false,
    generalWidth: 0,
    stimuliWidth: []
  }

  flashMessage: { message: string, type: 'error' | 'warn' | 'info' | 'success' } | null = null

  constructor (workplace: WorkplaceModel, stimulusId: number = 0) {
    super()
    this.addObserver(workplace)
    const data = workplace.data
    if (data === null) throw new Error('ScarfModel.constructor() - workplace.data is null')
    this.data = data
    this.tooltipComponent = new ScarfTooltipView(new ScarfTooltipController(new ScarfTooltipModel(data)))
    this.stimulusId = stimulusId
    this.isTimelineRelative = false
    this.participantIds = this.getParticipantIdsToProcess()
    this.absoluteTimeline = new AxisBreaks(this.getHighestEndTime(this.participantIds))
  }

  fireNewStimulus (stimulusId: number): void {
    this.stimulusId = stimulusId
    this.participantIds = this.getParticipantIdsToProcess()
    this.tooltipComponent.controller.model.stimulusId = stimulusId
    this.redraw()
  }

  redraw (): void {
    this.isTimelineRelative = false
    this.absoluteTimeline = new AxisBreaks(this.getHighestEndTime(this.participantIds))
    this.notify('stimulus', ['scarf-view'])
  }

  getData (): ScarfFilling {
    return new ScarfService(
      this.stimulusId, this.participantIds, this.absoluteTimeline, this.data, this.settings
    ).getViewFilling()
  }

  getTimelineUnit (): string {
    return this.isTimelineRelative ? '%' : 'ms'
  }

  getXAxisLabel (): string {
    return this.settings.ordinalTimeline ? 'Order index' : `Elapsed time [${this.getTimelineUnit()}]`
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

  getParticipantIdsToProcess (): number[] {
    const stimulusId = this.stimulusId
    const data = this.data
    const participantIdsToProcess = []
    for (let i = 0; i < data.noOfParticipants; i++) {
      if (data.getNoOfSegments(stimulusId, i) > 0) participantIdsToProcess.push(i)
    }
    return participantIdsToProcess
  }

  getHighestEndTime (participantsIds: number[]): number {
    const settings = this.settings
    const settingsWidth = settings.stimuliWidth[this.stimulusId] ?? settings.generalWidth
    let highestEndTime = settingsWidth // if settingsWidth can be 0 (auto)
    for (let i = 0; i < participantsIds.length; i++) {
      const id = participantsIds[i]
      const numberOfSegments = this.data.getNoOfSegments(this.stimulusId, id)
      if (numberOfSegments === 0) continue
      if (settings.ordinalTimeline) {
        if (numberOfSegments > highestEndTime) highestEndTime = numberOfSegments
        continue
      }
      const currentEndTime = this.data.getParticEndTime(this.stimulusId, id)
      if (currentEndTime > highestEndTime) {
        if (settingsWidth !== 0) {
          this.addFlashMessage('warn', 'The set axis width is smaller than the highest end time of the participants.')
          return highestEndTime
        }
        highestEndTime = currentEndTime
      }
    }
    return highestEndTime
  }

  addFlashMessage (type: 'error' | 'warn' | 'info' | 'success', message: string): void {
    this.flashMessage = { type, message }
    this.notify('scarf-flash', ['workplaceModel'])
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
