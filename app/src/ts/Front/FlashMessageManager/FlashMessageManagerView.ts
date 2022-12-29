import { AbstractView } from '../Common/AbstractView'
import { FlashMessageManagerController } from './FlashMessageManagerController'
import './flash-manager.css'

export class FlashMessageManagerView extends AbstractView {
  controller: FlashMessageManagerController
  el: HTMLElement
  constructor (controller: FlashMessageManagerController) {
    super()
    this.controller = controller
    this.el = this.createElement()
    document.body.appendChild(this.el)
  }

  createElement (): HTMLElement {
    const el = document.createElement('div')
    el.id = this.controller.model.elementId
    el.classList.add('flash-manager')
    return el
  }
}
