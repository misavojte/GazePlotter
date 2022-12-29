import { FlashMessageManagerModel } from './FlashMessageManagerModel'
import { AbstractController } from '../Common/AbstractController'

export class FlashMessageManagerController extends AbstractController {
  model: FlashMessageManagerModel
  constructor (model: FlashMessageManagerModel) {
    super()
    this.model = model
  }

  handleEvent (e: Event): void {
    console.warn('FlashMessageManagerController.handleEvent() not implemented', e)
  }
}
