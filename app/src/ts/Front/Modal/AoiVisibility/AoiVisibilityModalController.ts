import { AbstractModalController } from '../AbstractModalController'
import { AoiVisibilityModalModel } from './AoiVisibilityModalModel'

export class AoiVisibilityModalController extends AbstractModalController {
  model: AoiVisibilityModalModel
  constructor (model: AoiVisibilityModalModel) {
    super()
    this.model = model
  }

  handleSubmitEvent (e: Event): void {
    const target = e.target as HTMLFormElement
    const formData = new FormData(target)
    const file = formData.get('file')
    if (!(file instanceof File)) throw new Error('AoiVisibilityModalController.handleSubmitEvent() - file not File')
    this.model.fireAddInfo(file)
  }
}
