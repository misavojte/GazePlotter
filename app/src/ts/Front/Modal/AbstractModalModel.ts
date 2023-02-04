import { AbstractModel } from '../Common/AbstractModel'
import { WorkplaceModel } from '../Workplace/WorkplaceModel'
import { EyeTrackingData } from '../../Data/EyeTrackingData'

export abstract class AbstractModalModel extends AbstractModel {
  _data: EyeTrackingData | null = null
  title: string
  flashMessage: { message: string, type: 'error' | 'warn' | 'info' | 'success' } | null = null
  isRequestingModal: boolean = false

  protected constructor (workplaceModel: WorkplaceModel, title: string) {
    super()
    this._data = workplaceModel.data
    this.addObserver(workplaceModel)
    this.title = title
  }

  get data (): EyeTrackingData {
    const data = this._data
    if (data === null) throw new Error('No workplace data available in modal')
    return data
  }

  fireClose (): void {
    this.notify('close-modal')
  }

  fireOpen (): void {
    this.notify('open-modal', ['modal-view'])
  }

  addFlash (message: string, type: 'error' | 'warn' | 'info' | 'success'): void {
    this.flashMessage = { message, type }
    this.notify('modal-flash', ['workplaceModel'])
  }
}
