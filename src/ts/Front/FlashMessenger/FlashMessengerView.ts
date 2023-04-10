import { AbstractView } from '../Common/AbstractView'
import { FlashMessengerController } from './FlashMessengerController'
import './flash-manager.css'

export class FlashMessengerView extends AbstractView {
  controller: FlashMessengerController
  el: HTMLElement
  constructor (controller: FlashMessengerController) {
    super()
    controller.model.addObserver(this)
    this.controller = controller
    this.el = this.createManagerElement()
    this.el.onclick = (e) => { this.controller.handleEvent(e) }
    document.body.appendChild(this.el)
  }

  createManagerElement (): HTMLElement {
    const el = document.createElement('div')
    el.id = this.controller.model.elementId
    el.classList.add('flash-manager')
    return el
  }

  handleUpdate (msg: string): void {
    if (msg === 'add-flash') return this.addFlashMessage()
    if (msg === 'remove-flash') return this.removeFlashMessages(this.controller.model.messageIdsToRemove)
    super.handleUpdate(msg)
  }

  addFlashMessage (): void {
    const flashMessage = this.controller.model.messageToAdd
    if (flashMessage === null) throw new Error('FlashMessengerView.addFlashMessage() - flashMessage is null')
    const item = document.createElement('div')
    item.classList.add('flash-message-item')
    item.classList.add(flashMessage.type)
    item.classList.add(`msg-${flashMessage.id}`)
    item.innerHTML = flashMessage.message
    this.el.appendChild(item)
    requestAnimationFrame(() => {
      void this.growHeight(item).then(() => {
        this.fadeIn(item)
      })
    })
  }

  removeFlashMessage (id: number): void {
    const item = this.getElement(`.msg-${id}`) as HTMLElement
    item.style.opacity = '0'
    item.addEventListener('transitionend', () => {
      item.remove()
    })
  }

  removeFlashMessages (ids: number[]): void {
    ids.forEach((id) => {
      this.removeFlashMessage(id)
    })
  }

  async growHeight (item: HTMLElement): Promise<void> {
    item.style.height = `${item.scrollHeight}px`
    return await new Promise((resolve) => {
      item.addEventListener('transitionend', () => {
        resolve()
      }, { once: true })
    })
  }

  fadeIn (item: HTMLElement): void {
    item.style.opacity = '1'
  }
}
