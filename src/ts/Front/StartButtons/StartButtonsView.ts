import { StartButtonsController } from './StartButtonsController'
import { AbstractView } from '../Common/AbstractView'

export class StartButtonsView extends AbstractView {
  el: HTMLElement
  controller: StartButtonsController

  constructor (controller: StartButtonsController) {
    super()
    const el = document.querySelector('.cont1')
    if (!(el instanceof HTMLElement)) throw new TypeError('StartButtonsView element not found')
    this.el = el
    this.controller = controller
    // this.controller.model.addObserver(this) not needed now
    this.registerEventListeners(el, ['click', 'change'])
  }
}
