import { AbstractModalModel } from './AbstractModalModel'
import { AbstractController } from '../Common/AbstractController'

export abstract class AbstractModalController extends AbstractController {
  abstract model: AbstractModalModel

  handleEvent (e: Event): void {
    if (e.type === 'submit') {
      e.preventDefault()
      return this.handleSubmitEvent(e)
    }
    if (e.type === 'click') {
      const target = e.target as HTMLElement
      if (target.classList.contains('modalClose')) return this.model.fireClose()
      return this.handleOtherClickEvent(e)
    }
    this.handleOtherEvent(e)
  }

  handleOtherClickEvent (e: Event): void {
    console.warn('AbstractModalController.handleOtherClickEvent() not implemented', e)
  }

  handleOtherEvent (e: Event): void {
    console.warn('AbstractModalController.handleOtherEvent() not implemented', e)
  }

  handleSubmitEvent (e: Event): void {
    console.warn('AbstractModalController.handleSubmitEvent() not implemented', e)
  }
}
