import { StartButtonsController } from './StartButtonsController'
import { AbstractObserver } from '../Common/AbstractObserver'
import { ViewInterface } from '../Common/ViewInterface'

export class StartButtonsView extends AbstractObserver implements ViewInterface {
  el: HTMLElement
  controller: StartButtonsController

  constructor (controller: StartButtonsController) {
    super()
    const el = document.querySelector('.cont1')
    if (!(el instanceof HTMLElement)) throw new TypeError('StartButtonsView element not found')
    this.el = el
    this.controller = controller
    // this.controller.model.addObserver(this) not needed now
    this.registerEventListeners(el)
  }

  registerEventListeners (el: HTMLElement): void {
    const EVENT_TYPES: string[] = ['click', 'change']
    for (let eventIndex = 0; eventIndex < EVENT_TYPES.length; eventIndex++) {
      const toRegisterEvents = el.getElementsByClassName(`js-${EVENT_TYPES[eventIndex]}`)
      for (let i = 0; i < toRegisterEvents.length; i++) {
        toRegisterEvents[i].addEventListener(EVENT_TYPES[eventIndex], this.controller)
      }
    }
  }
}
