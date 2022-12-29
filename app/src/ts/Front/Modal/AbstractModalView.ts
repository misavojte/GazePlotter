import { AbstractView } from '../Common/AbstractView'
import { AbstractModalController } from './AbstractModalController'

export abstract class AbstractModalView extends AbstractView {
  el: HTMLElement
  abstract controller: AbstractModalController
  abstract bodyHtml: string
  observerType: string = 'modal-view'

  protected constructor (controller: AbstractModalController) {
    super()
    this.el = this.#createModalContainer()
    controller.model.addObserver(this)
  }

  handleUpdate (msg: string): void {
    if (msg === 'close-modal') return this.close()
    if (msg === 'open-modal') return this.open()
    this.handleOtherUpdate(msg)
  }

  handleOtherUpdate (msg: string): void {
    console.warn('AbstractModalView.handleUpdate() - unhandled update: ' + msg)
  }

  /** Close the modal. */
  close (): void {
    this.el.remove()
  }

  /** Init and open the modal. */
  open (): void {
    this.el.innerHTML = this.#printModalContainer()
    this.registerEventListeners(this.el, ['click', 'submit'])
    document.body.appendChild(this.el)
  }

  /** Create the modal container with id #modal-container if not already created */
  #createModalContainer (): HTMLElement {
    let modalContainer = document.getElementById('modal-container')
    if (modalContainer === null) {
      modalContainer = document.createElement('div')
      modalContainer.id = 'modal-container'
      document.body.appendChild(modalContainer)
    }
    return modalContainer
  }

  #printModalContainer (): string {
    return `
        <div class="interModal">
          <div class="modal-header">
            <h2>${this.controller.model.title}</h2>
            <div class="modalClose js-click">X</div>
          </div>
          <div class="modal-body">
            ${this.bodyHtml}
          </div>
        </div>`
  }
}
