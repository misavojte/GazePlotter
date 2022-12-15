import { WorkplaceController } from './WorkplaceController'
import { AbstractView } from '../Common/AbstractView'

export class WorkplaceView extends AbstractView {
  controller: WorkplaceController
  el: HTMLElement

  constructor (controller: WorkplaceController) {
    super()
    this.controller = controller
    this.el = this.creatWorkplaceElement()
    this.registerEventListeners(this.el, ['click'])
    this.controller.model.addObserver(this)
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
      case 'print' :
        return this.print()
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

  print (): void {
    // TODO FIX
    const el = this.controller.model.scarfs[0].el
    const wp = document.getElementById('workplace')
    if (!(wp instanceof HTMLElement)) throw ReferenceError('')
    wp.innerHTML = ''
    wp.append(el)
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
