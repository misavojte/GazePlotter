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
    this.controller.model.addObserver(this)
    this.registerEventListeners(el, ['click', 'change'])
  }

  handleUpdate (msg: string): void {
    void msg
    this.controller.model.isProcessing ? this.disableButtons() : this.enableButtons()
  }

  disableButtons (): void {
    this.el.classList.add('disabled')
    this.getElement('#file-upload').setAttribute('disabled', 'disabled')
  }

  enableButtons (): void {
    this.el.classList.remove('disabled')
    const input = this.getElement('#file-upload')
    input.removeAttribute('disabled')
    if (input instanceof HTMLInputElement) input.value = ''
  }
}
