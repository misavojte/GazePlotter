import { AbstractModel } from '../Common/AbstractModel'
import { WorkplaceModel } from '../Workplace/WorkplaceModel'
import { EyeTrackingData } from '../../Data/EyeTrackingData'
import { FlashMessageItemModel } from '../FlashMessageItem/FlashMessageItemModel'

export abstract class AbstractModalModel extends AbstractModel {
  data: EyeTrackingData
  title: string
  flashMessage: FlashMessageItemModel | null = null

  protected constructor (workplaceModel: WorkplaceModel, title: string) {
    super()
    const data = workplaceModel.data
    if (data === null) throw new Error('No workplace data available')
    this.data = data
    this.addObserver(workplaceModel)
    this.title = title
  }

  fireClose (): void {
    this.notify('close-modal')
  }

  fireOpen (): void {
    this.notify('open-modal', ['modal-view'])
  }

  addFlash (message: string, type: 'error' | 'warn' | 'info' | 'success'): void {
    this.flashMessage = new FlashMessageItemModel(message, type)
    this.notify('modal-flash')
  }
}
