import { AbstractView } from '../Common/AbstractView'
import { FlashMessageItemController } from './FlashMessageItemController'
import './FlashMessageItemStyle.css'

export class FlashMessageItemView extends AbstractView {
  controller: FlashMessageItemController
  el: HTMLElement
  constructor (controller: FlashMessageItemController) {
    super()
    controller.model.addObserver(this)
    this.controller = controller
    this.el = this.createElement()
  }

  handleUpdate (msg: string): void {
    if (msg === 'close-flash') return this.close()
    super.handleUpdate(msg)
  }

  close (): void {
    this.el.style.opacity = '0'
    this.el.addEventListener('transitionend', () => {
      this.el.remove()
    })
  }

  createElement (): HTMLElement {
    const item = document.createElement('div')
    item.classList.add('flash-message-item')
    item.classList.add(this.controller.model.type)
    item.innerHTML = this.printInnerHtml()
    return item
  }

  async render (managerDomId: string): Promise<void> {
    const manager = document.getElementById(managerDomId)
    if (manager === null) throw new Error('FlashMessageItemView.render() - managerDomId not found')
    manager.appendChild(this.el)
    // on transition end (getting from height 0 to autofit height), do another transition (fade in) - after that, return resolved promise
    requestAnimationFrame(() => {
      void this.growHeight().then(async () => await this.fadeIn()).then(async () => {
        return await Promise.resolve()
      })
    })
  }

  // function to automatically grow height of flash message item to fit content from zero height
  async growHeight (): Promise<void> {
    this.el.style.height = `${this.el.scrollHeight}px`
    return await new Promise((resolve) => {
      this.el.addEventListener('transitionend', () => {
        resolve()
      }, { once: true })
    })
  }

  // function to fade in flash message item
  async fadeIn (): Promise<void> {
    this.el.style.opacity = '1'
    return await new Promise((resolve) => {
      this.el.addEventListener('transitionend', () => {
        resolve()
      }, { once: true })
    })
  }

  printInnerHtml (): string {
    return `
    <div class="flash-message-item__message">${this.controller.model.message}</div>
    <div class="flash-message-item__close">X</div>
    `
  }
}
