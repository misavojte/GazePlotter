import { AbstractObserver } from './AbstractObserver'
import { AbstractController } from './AbstractController'

export abstract class AbstractView extends AbstractObserver {
  abstract controller: AbstractController
  abstract el: HTMLElement

  /**
   * Method to register event listeners. It will register all elements with class name js-{event type} to event type.
   * @param el - Element to register event listeners
   * @param eventTypes - Event types to register
   */
  registerEventListeners (el: HTMLElement, eventTypes: string[]): void {
    for (let eventIndex = 0; eventIndex < eventTypes.length; eventIndex++) {
      const toRegisterEvents = el.getElementsByClassName(`js-${eventTypes[eventIndex]}`)
      for (let i = 0; i < toRegisterEvents.length; i++) {
        toRegisterEvents[i].addEventListener(eventTypes[eventIndex], this.controller)
      }
    }
  }
}
