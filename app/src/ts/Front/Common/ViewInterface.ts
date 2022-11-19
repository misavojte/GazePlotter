import { AbstractObserver } from './AbstractObserver'
import { ControllerInterface } from './ControllerInterface'

export interface ViewInterface extends AbstractObserver {

  controller: ControllerInterface
  el: HTMLElement

  registerEventListeners: (el: HTMLElement) => void
}
