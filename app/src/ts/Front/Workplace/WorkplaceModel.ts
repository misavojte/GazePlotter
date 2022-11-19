import { AbstractPublisher } from '../Common/AbstractPublisher'
import { ModelInterface } from '../Common/ModelInterface'
import { EyeTrackingData } from './EDT'
import { StartButtonsModel } from '../StartButtons/StartButtonsModel'

export class WorkplaceModel extends AbstractPublisher implements ModelInterface {
  observerType = 'workplaceModel'
  isVisible: boolean = false
  data: EyeTrackingData | null = null
  startButtonsModel: StartButtonsModel

  constructor (startButtonsModel: StartButtonsModel) {
    super()
    this.startButtonsModel = startButtonsModel
  }

  handleUpdate (msg: string): void {
    switch (msg) {
      case 'start' : return this.startNewLoading()
      case 'eyeTrackingData' : return this.startPrintingFirstChart()
      default : super.handleUpdate(msg)
    }
  }

  startNewLoading (): void {
    if (this.isVisible) {
      return this.notify('reload', [])
    }
    this.notify('reveal', [])
    this.isVisible = true
  }

  startPrintingFirstChart (): void {
    const file = this.startButtonsModel.jsonFile
    if (file === null) return
    this.data = new EyeTrackingData(file)
    this.startButtonsModel.jsonFile = null
  }
}
