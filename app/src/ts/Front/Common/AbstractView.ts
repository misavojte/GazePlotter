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
      if (toRegisterEvents.length === 0) console.warn(`No elements with class name js-${eventTypes[eventIndex]} found.`, el)
      for (let i = 0; i < toRegisterEvents.length; i++) {
        toRegisterEvents[i].addEventListener(eventTypes[eventIndex], this.controller)
      }
    }
  }

  /** Method to get an element from the view.
   * @param selector - CSS selector to get the element
   */
  getElement (selector: string): Element {
    const element = this.el.querySelector(selector)
    if (!(element instanceof Element)) throw ReferenceError(`Element ${selector} not found in view`)
    return element
  }
}
