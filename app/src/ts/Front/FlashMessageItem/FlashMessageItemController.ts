import { AbstractController } from '../Common/AbstractController'
import { FlashMessageItemModel } from './FlashMessageItemModel'

export class FlashMessageItemController extends AbstractController {
  model: FlashMessageItemModel
  constructor (model: FlashMessageItemModel) {
    super()
    this.model = model
  }

  handleEvent (e: Event): void {
    void e
    this.model.fireClose()
  }
}
