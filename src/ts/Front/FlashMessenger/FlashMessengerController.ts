import { FlashMessengerModel } from './FlashMessengerModel'
import { AbstractController } from '../Common/AbstractController'

export class FlashMessengerController extends AbstractController {
  model: FlashMessengerModel
  constructor (model: FlashMessengerModel) {
    super()
    this.model = model
  }

  handleEvent (e: Event): void {
    const type = e.type
    switch (type) {
      case 'click':
        return this.handleCloseClick(e)
      default:
        console.warn(`FlashMessengerController.handleEvent() - Unhandled event type: ${type}`)
    }
  }

  handleCloseClick (e: Event): void {
    const target = e.target as HTMLElement
    if (target.classList.contains('flash-message-item')) {
      const id = parseInt(target.classList[2].split('-')[1])
      this.model.removeFlashMessage(id)
    }
  }
}
