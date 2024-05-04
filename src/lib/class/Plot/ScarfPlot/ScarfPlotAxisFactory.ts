import type { ScarfGridType } from '$lib/type/gridType.ts'
import {
  getNumberOfSegments,
  getParticipantEndTime,
} from '$lib/stores/dataStore.js'
import { PlotAxisBreaks } from '../PlotAxisBreaks/PlotAxisBreaks.ts'

export class ScarfPlotAxisFactory {
  stimulusId: number
  settings: ScarfGridType
  participantIds: number[]
  isCut: boolean

  constructor(
    participantIds: number[],
    stimulusId: number,
    settings: ScarfGridType
  ) {
    this.settings = settings
    this.participantIds = participantIds
    this.isCut = false
    this.stimulusId = stimulusId
  }

  getAxis(): PlotAxisBreaks {
    const highestEndTime = this.getHighestEndTime()
    return new PlotAxisBreaks(highestEndTime)
  }

  getHighestEndTime(): number {
    const settings = this.settings
    if (settings.timeline === 'relative') return 100

    const absoluteTimelineLastVal =
      settings.absoluteStimuliLastVal[this.stimulusId] ??
      settings.absoluteGeneralLastVal
    const ordinalTimelineLastVal =
      settings.ordinalStimuliLastVal[this.stimulusId] ??
      settings.ordinalGeneralLastVal

    let highestEndTime =
      settings.timeline === 'absolute'
        ? absoluteTimelineLastVal
        : ordinalTimelineLastVal // if absoluteTimelineLastVal can be 0 (auto)
    // go through all participants and find the highest end time
    for (let i = 0; i < this.participantIds.length; i++) {
      const id = this.participantIds[i]
      const numberOfSegments = getNumberOfSegments(this.stimulusId, id)
      if (numberOfSegments === 0) continue
      if (settings.timeline === 'ordinal') {
        if (numberOfSegments > highestEndTime) {
          if (ordinalTimelineLastVal !== 0) {
            this.isCut = true
            return highestEndTime
          }
          highestEndTime = numberOfSegments
        }
        continue
      }
      const currentEndTime = getParticipantEndTime(this.stimulusId, id)
      if (currentEndTime > highestEndTime) {
        if (absoluteTimelineLastVal !== 0) {
          this.isCut = true
          return highestEndTime
        }
        highestEndTime = currentEndTime
      }
    }
    return highestEndTime
  }
}
