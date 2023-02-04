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
import { FlashMessengerModel } from '../FlashMessenger/FlashMessengerModel'
import { ScarfSettingsModalModel } from '../Modal/ScarfSettings/ScarfSettingsModalModel'
import { ScarfSettingsModalView } from '../Modal/ScarfSettings/ScarfSettingsModalView'
import { ScarfSettingsModalController } from '../Modal/ScarfSettings/ScarfSettingsModalController'
import { AoiVisibilityModalModel } from '../Modal/AoiVisibility/AoiVisibilityModalModel'
import { AoiVisibilityModalController } from '../Modal/AoiVisibility/AoiVisibilityModalController'
import { AoiVisibilityModalView } from '../Modal/AoiVisibility/AoiVisibilityModalView'
import { ScarfDownloadModalModel } from '../Modal/ScarfDownload/ScarfDownloadModalModel'
import { ScarfDownloadModalView } from '../Modal/ScarfDownload/ScarfDownloadModalView'
import { ScarfDownloadModalController } from '../Modal/ScarfDownload/ScarfDownloadModalController'
import { AoiSettingsModalModel } from '../Modal/AoiSettings/AoiSettingsModalModel'
import { AoiSettingsModalView } from '../Modal/AoiSettings/AoiSettingsModalView'
import { AoiSettingsModalController } from '../Modal/AoiSettings/AoiSettingsModalController'
import { TobiiUploadModalController } from '../Modal/TobiiUpload/TobiiUploadModalController'
import { TobiiUploadModalView } from '../Modal/TobiiUpload/TobiiUploadModalView'
import { TobiiUploadModalModel } from '../Modal/TobiiUpload/TobiiUploadModalModel'

export class WorkplaceModel extends AbstractModel {
  readonly observerType = 'workplaceModel'
  isVisible: boolean = false
  data: EyeTrackingData | null = null
  startButtonsModel: StartButtonsModel
  scarfs: ScarfView[] = []
  modal: AbstractModalModel | null = null
  flashManager: FlashMessengerModel = new FlashMessengerModel()

  constructor (startButtonsModel: StartButtonsModel) {
    super()
    this.startButtonsModel = startButtonsModel
  }

  handleUpdate (msg: string): void {
    switch (msg) {
      case 'start' : return this.startNewLoading()
      case 'eyeTrackingData' : return this.startPrintingFirstChart()
      case 'close-modal' : return this.fireCloseModal()
      case 'modal-flash' : return this.fireFlashFromModal()
      case 'redraw' : return this.redraw()
      case 'open-scarf-settings-modal' : return this.initScarfSettingsModal()
      case 'open-aoi-visibility-modal' : return this.initAoiVisibilityModal()
      case 'open-scarf-download-modal' : return this.initScarfDownloadModal()
      case 'open-aoi-settings-modal' : return this.initAoiSettingsModal()
      case 'open-tobii-upload-modal' : return this.initTobiiUploadModal()
      default : super.handleUpdate(msg)
    }
  }

  openWorkplaceModal (): void {
    const modalModel = new WorkplaceDownloadModalModel(this)
    void new WorkplaceDownloadModalView(new WorkplaceDownloadModalController(modalModel)) // will be referenced by modalModel as observer
    this.modal = modalModel
    modalModel.fireOpen()
  }

  fireCloseModal (): void {
    if (this.modal instanceof TobiiUploadModalModel) {
      this.startButtonsModel.fireUploadWithUserInput(this.modal.parsingType)
    }
    this.modal = null
  }

  startNewLoading (): void {
    this.flashManager.addFlashMessage('New workplace started', 'info')
    if (this.isVisible) {
      return this.notify('reload', [])
    }
    this.notify('reveal', [])
    this.isVisible = true
  }

  redraw (): void {
    this.scarfs.forEach(scarf => scarf.controller.model.redraw())
  }

  startPrintingFirstChart (): void {
    const file = this.startButtonsModel.eyeTrackingData
    if (file === null) return
    this.data = new EyeTrackingData(file)
    this.startButtonsModel.eyeTrackingData = null
    this.scarfs = [] // todo: check circular reference
    this.scarfs.push(new ScarfView(new ScarfController(new ScarfModel(this, 0))))
    this.notify('print', [])
    this.scarfs[0].controller.model.isDetached = false
    this.flashManager.addFlashMessage('Scarf chart printed', 'info')
  }

  fireFlashFromModal (): void {
    const flash = this.modal?.flashMessage
    if (flash == null) return
    this.flashManager.addFlashMessage(flash.message, flash.type)
  }

  initScarfSettingsModal (): void {
    const initiator = this.#getModalInitiator()
    if (!(initiator instanceof ScarfModel)) throw new Error('WorkplaceModel.initScarfSettingsModal() - modal initiator is not a scarf model')
    const modalModel = new ScarfSettingsModalModel(this, initiator.stimulusId, initiator.scarfId)
    void new ScarfSettingsModalView(new ScarfSettingsModalController(modalModel)) // will be referenced by modalModel as observer
    this.modal = modalModel
    modalModel.fireOpen()
  }

  initAoiVisibilityModal (): void {
    const initiator = this.#getModalInitiator()
    if (!(initiator instanceof ScarfSettingsModalModel)) throw new Error('WorkplaceModel.initAoiVisibilityModal() - modal initiator is not a scarf settings modal model')
    const modalModel = new AoiVisibilityModalModel(this, initiator.stimulusId, initiator.scarfId)
    void new AoiVisibilityModalView(new AoiVisibilityModalController(modalModel)) // will be referenced by modalModel as observer
    this.modal = modalModel
    modalModel.fireOpen()
  }

  initScarfDownloadModal (): void {
    const initiator = this.#getModalInitiator()
    if (!(initiator instanceof ScarfModel)) throw new Error('WorkplaceModel.initDownloadScarfModal() - modal initiator is not a scarf model')
    const modalModel = new ScarfDownloadModalModel(this, initiator.stimulusId, initiator.scarfId)
    void new ScarfDownloadModalView(new ScarfDownloadModalController(modalModel)) // will be referenced by modalModel as observer
    this.modal = modalModel
    modalModel.fireOpen()
  }

  initAoiSettingsModal (): void {
    const initiator = this.#getModalInitiator()
    if (!(initiator instanceof ScarfSettingsModalModel) && !(initiator instanceof ScarfModel)) throw new Error('WorkplaceModel.initAoiSettingsModal() - modal initiator is not a scarf settings model or scarf')
    const modalModel = new AoiSettingsModalModel(this, initiator.stimulusId)
    void new AoiSettingsModalView(new AoiSettingsModalController(modalModel)) // will be referenced by modalModel as observer
    this.modal = modalModel
    modalModel.fireOpen()
  }

  initTobiiUploadModal (): void {
    const modalModel = new TobiiUploadModalModel(this)
    void new TobiiUploadModalView(new TobiiUploadModalController(modalModel))
    this.modal = modalModel
    modalModel.fireOpen()
  }

  #getModalInitiator (): ScarfModel | AbstractModalModel {
    const initiator = (this.modal?.isRequestingModal != null) ? this.modal : this.scarfs.find(scarf => scarf.controller.model.isRequestingModal)?.controller.model
    if (initiator == null) throw new Error('WorkplaceModel.#getModalInitiator() - no modal initiator found')
    initiator.isRequestingModal = false
    return initiator
  }
}
