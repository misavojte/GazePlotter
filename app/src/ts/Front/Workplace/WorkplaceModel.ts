import { AbstractModel } from '../Common/AbstractModel'
import { EyeTrackingData } from '../../Data/EyeTrackingData'
import { StartButtonsModel } from '../StartButtons/StartButtonsModel'
import { ScarfView } from '../Scarf/ScarfView'
import { ScarfModel } from '../Scarf/ScarfModel'
import { ScarfController } from '../Scarf/ScarfController'

export class WorkplaceModel extends AbstractModel {
  observerType = 'workplaceModel'
  isVisible: boolean = false
  data: EyeTrackingData | null = null
  startButtonsModel: StartButtonsModel
  scarfs: ScarfView[] = []

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
    this.scarfs.push(new ScarfView(new ScarfController(new ScarfModel(this.data, 0))))
    this.notify('print', [])
    this.scarfs[0].controller.model.isDetached = false
  }
}
