import { AbstractObserver } from '../Common/AbstractObserver'
import { WorkplaceController } from './WorkplaceController'
import { ViewInterface } from '../Common/ViewInterface'

export class WorkplaceView extends AbstractObserver implements ViewInterface {
  controller: WorkplaceController
  el: HTMLElement

  constructor (controller: WorkplaceController) {
    super()
    this.controller = controller
    this.el = this.creatWorkplaceElement()
    this.registerEventListeners(this.el)
    this.controller.model.addObserver(this)
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

  creatWorkplaceElement (): HTMLElement {
    const el = document.createElement('section')
    el.style.display = 'none'
    el.className = 'anim'
    el.id = 'analysis'
    el.innerHTML = this.createStartingInnerHtml()
    document.querySelector('main')
      ?.insertBefore(el, document.getElementById('about'))
    return el
  }

  handleUpdate (msg: string): void {
    switch (msg) {
      case 'reveal' :
        return this.reveal()
      case 'start' :
        return this.addLoader()
    }
  }

  reveal (): void {
    this.el.style.display = ''
  }

  addLoader (): void {
    const el = document.getElementById('workplace')
    if (!(el instanceof HTMLElement)) throw ReferenceError('')
    el.innerHTML = this.createLoaderOuterHtml()
  }

  createStartingInnerHtml (): string {
    return `
<h2 class='main-section ana-title'>Your analysis and visualization</h2>
<div class='btnholder left-align main-section'>
    <button id='save-workplace' class='btn4 js-click'>Save workplace</button>
</div>
<div id='workplace'>
${this.createLoaderOuterHtml()}
</div>`
  }

  createLoaderOuterHtml (): string {
    return `
<div id='loader-wrap'>
    <div class='bars-7'></div>
    <div>Processing your precious data</div>
</div>
        `
  }
}
