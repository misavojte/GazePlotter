import type {
  AoiVisibilityScarfFillingType,
  ParticipantScarfFillingType,
  ScarfFillingType,
  SegmentScarfFillingType,
  SingleAoiVisibilityScarfFillingType,
  SingleSegmentScarfFillingType,
  SingleStylingScarfFillingType,
  StimulusScarfFillingType,
  StylingScarfFillingType,
} from '$lib/type/Filling/ScarfFilling/index.js'
import { PlotAxisBreaks } from '../PlotAxisBreaks/PlotAxisBreaks.ts'
import type { ScarfGridType } from '$lib/type/gridType.ts'
import {
  IDENTIFIER_IS_AOI,
  IDENTIFIER_IS_OTHER_CATEGORY,
  IDENTIFIER_NOT_DEFINED,
} from '$lib/const/identifiers.ts'
import {
  getAois,
  getAoiVisibility,
  getNumberOfSegments,
  getParticipant,
  getParticipantEndTime,
  getSegment,
  getStimuli,
  hasStimulusAoiVisibility,
} from '$lib/stores/dataStore.js'
import type { ExtendedInterpretedDataType } from '$lib/type/Data/InterpretedData/ExtendedInterpretedDataType.js'
import type { BaseInterpretedDataType } from '$lib/type/Data/InterpretedData/BaseInterpretedDataType.js'
import type { SegmentInterpretedDataType } from '$lib/type/Data/InterpretedData/SegmentInterpretedDataType.js'
import { getScarfParticipantBarHeight } from '$lib/services/scarfServices.ts'

/**
 * Factory for data filling which is used to render scarf plot.
 */
export class ScarfPlotFillingFactoryS {
  HEIGHT_OF_X_AXIS = 20

  // todo move to settings
  showTheseSegmentCategories: number[] = [0, 1]
  heightOfBar = 20
  heightOfNonFixation = 4
  stimulusId: number
  spaceAboveRect: number
  spaceAboveLine = 2

  aoiData: ExtendedInterpretedDataType[]
  stimuliData: BaseInterpretedDataType[]

  participants: ParticipantScarfFillingType[]
  timeline: PlotAxisBreaks
  stimuli: StimulusScarfFillingType[]
  stylingAndLegend: StylingScarfFillingType
  chartHeight: number
  settings: ScarfGridType

  hasAtLeastOneAoiVisibility = false

  get rectWrappedHeight(): number {
    return this.heightOfBar + this.spaceAboveRect * 2
  }

  get lineWrappedHeight(): number {
    return this.heightOfNonFixation + this.spaceAboveLine
  }

  get heightOfBarWrap(): number {
    return getScarfParticipantBarHeight(
      this.heightOfBar,
      this.spaceAboveRect,
      this.aoiData.length,
      this.showAoiVisibility,
      this.lineWrappedHeight
    )
  }

  get showAoiVisibility(): boolean {
    return (
      this.hasAtLeastOneAoiVisibility && this.settings.timeline !== 'ordinal'
    )
  }

  constructor(
    stimulusId: number,
    participantIds: number[],
    axis: PlotAxisBreaks,
    settings: ScarfGridType,
    participGap = 10
  ) {
    this.stimulusId = stimulusId
    this.hasAtLeastOneAoiVisibility = hasStimulusAoiVisibility(stimulusId)
    this.settings = settings
    this.spaceAboveRect = participGap / 2
    this.aoiData = getAois(stimulusId)
    this.stimuliData = getStimuli()
    this.timeline = axis
    const participants = []
    for (let i = 0; i < participantIds.length; i++) {
      const participant = this.#prepareParticipant(participantIds[i])
      if (participant !== null) participants.push(participant)
    }
    this.participants = participants
    this.chartHeight =
      participants.length * this.heightOfBarWrap + this.HEIGHT_OF_X_AXIS
    this.stimuli = this.#prepareStimuliList()
    this.stylingAndLegend = this.#prepareStylingAndLegend()
  }

  getFilling(): ScarfFillingType {
    return {
      id: this.stimulusId,
      timelineType: this.settings.timeline,
      barHeight: this.heightOfBar,
      stimulusId: this.stimulusId,
      heightOfBarWrap: this.heightOfBarWrap,
      chartHeight: this.chartHeight,
      stimuli: this.stimuli,
      participants: this.participants,
      timeline: this.timeline,
      stylingAndLegend: this.stylingAndLegend,
    }
  }

  #prepareStimuliList(): StimulusScarfFillingType[] {
    return this.stimuliData.map(stimulus => {
      return {
        id: stimulus.id,
        name: stimulus.displayedName,
      }
    })
  }

  #prepareStylingAndLegend(): StylingScarfFillingType {
    const aoi: SingleStylingScarfFillingType[] = this.aoiData.map(aoi => {
      return {
        identifier: `${IDENTIFIER_IS_AOI}${aoi.id}`,
        name: aoi.displayedName,
        color: aoi.color,
        height: this.heightOfBar,
        heighOfLegendItem: this.heightOfBar,
      }
    })

    const stylingFixationButNoAoi: SingleStylingScarfFillingType = {
      identifier: `${IDENTIFIER_IS_AOI}${IDENTIFIER_NOT_DEFINED}`,
      name: 'No AOI hit',
      color: '#a6a6a6',
      height: this.heightOfBar,
      heighOfLegendItem: this.heightOfBar,
    }
    aoi.push(stylingFixationButNoAoi)
    // TODO PŘEDĚLAT
    // for (let i = 1; i < this.showTheseSegmentCategories.length; i++) {
    //
    //
    // }
    const stylingSaccade: SingleStylingScarfFillingType = {
      identifier: `${IDENTIFIER_IS_OTHER_CATEGORY}${1}`,
      name: 'Saccade',
      color: '#555555',
      height: this.heightOfNonFixation,
      heighOfLegendItem: this.heightOfBar,
    }
    const stylingOther: SingleStylingScarfFillingType = {
      identifier: `${IDENTIFIER_IS_OTHER_CATEGORY}${IDENTIFIER_NOT_DEFINED}`,
      name: 'Other',
      color: '#a6a6a6',
      height: this.heightOfNonFixation,
      heighOfLegendItem: this.heightOfBar,
    }
    const category = []
    category.push(stylingSaccade)
    category.push(stylingOther)

    return {
      visibility: this.#prepareVisibilityStyling(),
      aoi,
      category,
    }
  }

  #prepareVisibilityStyling(): SingleStylingScarfFillingType[] {
    const iterateTo = this.aoiData.length
    const response: SingleStylingScarfFillingType[] = []
    if (!this.showAoiVisibility) return response
    for (let i = 0; i < iterateTo; i++) {
      const currentAoi = this.aoiData[i]
      const stylingBaseAoi: SingleStylingScarfFillingType = {
        identifier: `${IDENTIFIER_IS_AOI}${currentAoi.id}`,
        name: currentAoi.displayedName,
        color: currentAoi.color,
        height: this.heightOfNonFixation,
        heighOfLegendItem: this.heightOfBar,
      }
      response.push(stylingBaseAoi)
    }
    return response
  }

  #prepareParticipant(id: number): ParticipantScarfFillingType {
    const iterateTo = getNumberOfSegments(this.stimulusId, id)
    const sessionDuration = getParticipantEndTime(this.stimulusId, id)
    const label = getParticipant(id).displayedName
    const width =
      this.settings.timeline === 'relative'
        ? '100%'
        : `${(sessionDuration / this.timeline.maxLabel) * 100}%`
    const segments = []
    for (let i = 0; i < iterateTo; i++) {
      segments.push(this.#prepareSegment(id, i, sessionDuration))
    }
    // TODO napravit height
    // ?? dafak :D
    return {
      dynamicAoiVisibility: this.#prepareDynamicVisibility(id, sessionDuration),
      id,
      label,
      segments,
      width,
    }
  }

  #prepareDynamicVisibility(
    participantId: number,
    sessionDuration: number
  ): AoiVisibilityScarfFillingType[] {
    const response: AoiVisibilityScarfFillingType[] = []
    if (!this.showAoiVisibility) return response
    for (let aoiIndex = 0; aoiIndex < this.aoiData.length; aoiIndex++) {
      const aoiId = this.aoiData[aoiIndex].id
      const visibility = getAoiVisibility(this.stimulusId, aoiId, participantId)
      const visibilityContent: SingleAoiVisibilityScarfFillingType[] = []
      if (visibility !== null) {
        for (let i = 0; i < visibility.length; i = i + 2) {
          const start = visibility[i]
          const end = visibility[i + 1]
          const y = this.rectWrappedHeight + aoiIndex * this.lineWrappedHeight
          visibilityContent.push(
            this.#getDynamicAoiVisibilityContent(
              start,
              end,
              y,
              sessionDuration,
              aoiId
            )
          )
        }
      }
      const visibilityObj: AoiVisibilityScarfFillingType = {
        content: visibilityContent,
      }
      response.push(visibilityObj)
    }
    return response
  }

  #getDynamicAoiVisibilityContent(
    start: number,
    end: number,
    y: number,
    sessionDuration: number,
    aoiId: number
  ): SingleAoiVisibilityScarfFillingType {
    const x1 = `${(start / sessionDuration) * 100}%`
    const x2 = `${(end / sessionDuration) * 100}%`
    const identifier = `${IDENTIFIER_IS_AOI}${aoiId}`
    return {
      x1,
      x2,
      y,
      identifier,
    }
  }

  /**
   *
   * @param {int} participantId
   * @param {int} segmentId
   * @param sessionDuration total session duration [ms] for given participant
   */
  #prepareSegment(
    participantId: number,
    segmentId: number,
    sessionDuration: number
  ): SegmentScarfFillingType {
    const segment = getSegment(this.stimulusId, participantId, segmentId)
    const isOrdinal = this.settings.timeline === 'ordinal'
    const start = isOrdinal ? segmentId : segment.start
    const end = isOrdinal ? segmentId + 1 : segment.end
    const x = `${(start / sessionDuration) * 100}%`
    const width = `${((end - start) / sessionDuration) * 100}%`
    return { content: this.#prepareSegmentContents(segment, x, width) }
  }

  #prepareSegmentContents(
    segment: SegmentInterpretedDataType,
    x: string,
    width: string
  ): SingleSegmentScarfFillingType[] {
    let aoiOrNotIdentifier = IDENTIFIER_IS_AOI
    let typeDistinctionIdentifier = IDENTIFIER_NOT_DEFINED

    const getIdentifier = (): string => {
      return aoiOrNotIdentifier + typeDistinctionIdentifier
    }

    if (segment.category.id !== 0) {
      const height = this.heightOfNonFixation
      const y = this.spaceAboveRect + this.heightOfBar / 2 - height / 2

      aoiOrNotIdentifier = IDENTIFIER_IS_OTHER_CATEGORY

      if (this.showTheseSegmentCategories.includes(segment.category.id))
        typeDistinctionIdentifier = segment.category.id.toString()

      const nonFixationSegmentContent: SingleSegmentScarfFillingType = {
        x,
        y,
        width,
        height,
        identifier: getIdentifier(),
      }
      return [nonFixationSegmentContent]
    }

    if (segment.aoi.length === 0) {
      const fixationWithoutAoiContent: SingleSegmentScarfFillingType = {
        x,
        y: this.spaceAboveRect,
        width,
        height: this.heightOfBar,
        identifier: getIdentifier(),
      }
      return [fixationWithoutAoiContent]
    }

    const height = this.heightOfBar / segment.aoi.length
    let yOfOneContent = this.spaceAboveRect
    const result = []
    for (const aoi of segment.aoi) {
      typeDistinctionIdentifier = aoi.id.toString()
      const fixationWithAoiContent: SingleSegmentScarfFillingType = {
        x,
        y: yOfOneContent,
        width,
        height,
        identifier: getIdentifier(),
      }
      result.push(fixationWithAoiContent)
      yOfOneContent += height
    }
    return result
  }
}
