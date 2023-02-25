import { AbstractModel } from '../Common/AbstractModel'
import { EyeTrackingData } from '../../Data/EyeTrackingData'

export class ScarfTooltipModel extends AbstractModel {
  stimulusId: number = 0
  observerType = 'scarfTooltipModel'
  isVisible: boolean = false
  x: number = 0
  y: number = 0
  participantName: string = ''
  categoryName: string = ''
  aoiNames: string = ''
  start: number = 0
  end: number = 0
  index: number = 0
  data: EyeTrackingData
  constructor (data: EyeTrackingData) {
    super()
    this.data = data
  }

  get duration (): number {
    return this.end - this.start
  }

  show (): void {
    this.isVisible = true
    this.notify('changeVisibility', [])
  }

  hide (): void {
    this.isVisible = false
    this.notify('changeVisibility', [])
  }

  redraw (participantId: number, segmentId: number, x: number, y: number): void {
    this.changeContent(participantId, segmentId)
    this.move(x, y)
    this.show()
  }

  move (x: number, y: number): void {
    this.x = x
    this.y = y
    this.notify('move', [])
  }

  changeContent (participantId: number, segmentId: number): void {
    const segmentInfo = this.data.getSegmentInfo(this.stimulusId, participantId, segmentId)
    this.participantName = this.data.getParticName(participantId)
    this.categoryName = this.data.getCatInfo(segmentInfo.category).displayedName
    this.aoiNames = segmentInfo.aoi.length > 0 ? segmentInfo.aoi.map(x => this.data.getAoiInfo(this.stimulusId, x).displayedName).join(', ') : 'No AOI hit'
    this.start = segmentInfo.start
    this.end = segmentInfo.end
    this.index = segmentId
    this.notify('redraw', [])
  }
}
