import { ScarfTooltipController } from './ScarfTooltipController'
import { AbstractView } from '../Common/AbstractView'

export class ScarfTooltipView extends AbstractView {
  controller: ScarfTooltipController
  el: HTMLElement
  constructor (controller: ScarfTooltipController) {
    super()
    this.controller = controller
    this.controller.model.addObserver(this)
    this.el = document.createElement('div')
    this.el.className = 'scarf-tooltip'
    this.setVisibility()
  }

  handleUpdate (msg: string): void {
    switch (msg) {
      case 'changeVisibility' :
        return this.setVisibility()
      case 'move':
        return this.move()
      case 'redraw':
        return this.redraw()
    }
    super.handleUpdate(msg)
  }

  setVisibility (): void {
    this.el.style.display = this.controller.model.isVisible ? '' : 'none'
  }

  move (): void {
    this.el.innerHTML = this.#createTooltipInnerHtml()
    this.el.style.left = `${this.controller.model.x}px`
    this.el.style.top = `${this.controller.model.y}px`
  }

  redraw (): void {
    this.el.innerHTML = this.#createTooltipInnerHtml()
    this.move()
    this.setVisibility()
  }

  #createTooltipInnerHtml (): string {
    const model = this.controller.model
    let result = `
  <div>
    <div>Participant</div>
    <div>${model.participantName}</div>
  </div>
  <div>
    <div>Category</div>
    <div>${model.categoryName}</div>
  </div>
  <div>
    <div>AOI</div>
    <div>${model.aoiNames}</div>
  </div>
  <div>
    <div>Order index</div>
    <div>${model.index}</div>
  </div>`
    if (!model.data.main.isOrdinalOnly) {
      result += `
  <div>
    <div>Event start</div>
    <div>${model.start.toFixed(1)} ms</div>
  </div>
  <div>
    <div>Event end</div>
    <div>${model.end.toFixed(1)} ms</div>
  </div>
  <div>
    <div>Event duration</div>
    <div>${model.duration.toFixed(1)} ms</div>
  </div>`
    }
    return result
  }
}
