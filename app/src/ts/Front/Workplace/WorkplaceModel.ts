import { AbstractModel } from '../Common/AbstractModel'
import { EyeTrackingData } from '../../Data/EyeTrackingData'
import { StartButtonsModel } from '../StartButtons/StartButtonsModel'
import { ScarfView } from '../Scarf/ScarfView'
import { ScarfModel } from '../Scarf/ScarfModel'
import { ScarfController } from '../Scarf/ScarfController'
import { AbstractModalModel } from '../Modal/AbstractModalModel'
import { WorkplaceDownloadModalModel } from '../Modal/WorkplaceDownload/WorkplaceDownloadModalModel'
import { WorkplaceDownloadModalController } from '../Modal/WorkplaceDownload/WorkplaceDownloadModalController'
import { WorkplaceDownloadModalView } from '../Modal/WorkplaceDownload/WorkplaceDownloadModalView'
import { FlashMessageManagerModel } from '../FlashMessageManager/FlashMessageManagerModel'

export class WorkplaceModel extends AbstractModel {
  observerType = 'workplaceModel'
  isVisible: boolean = false
  data: EyeTrackingData | null = null
  startButtonsModel: StartButtonsModel
  scarfs: ScarfView[] = []
  modal: AbstractModalModel | null = null
  flashManager: FlashMessageManagerModel = new FlashMessageManagerModel()

  constructor (startButtonsModel: StartButtonsModel) {
    super()
    this.startButtonsModel = startButtonsModel
  }

  handleUpdate (msg: string): void {
    switch (msg) {
      case 'start' : return this.startNewLoading()
      case 'eyeTrackingData' : return this.startPrintingFirstChart()
      case 'close-modal' : this.modal = null; return
      case 'modal-flash' : return this.fireFlashFromModal()
      default : super.handleUpdate(msg)
    }
  }

  openWorkplaceModal (): void {
    const modalModel = new WorkplaceDownloadModalModel(this)
    void new WorkplaceDownloadModalView(new WorkplaceDownloadModalController(modalModel)) // will be referenced by modalModel as observer
    this.modal = modalModel
    modalModel.fireOpen()
  }

  startNewLoading (): void {
    this.flashManager.addFlashMessage('New workplace started', 'info')
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
    this.flashManager.addFlashMessage('Scarf chart printed', 'info')
  }

  fireFlashFromModal (): void {
    const flash = this.modal?.flashMessage
    if (flash == null) return
    this.flashManager.addFlashFromModel(flash)
  }
}
