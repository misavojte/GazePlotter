import { ScarfModel } from './ScarfModel'
import { AbstractController } from '../Common/AbstractController'

export class ScarfController implements AbstractController {
  model: ScarfModel

  constructor (model: ScarfModel) {
    this.model = model
  }

  handleEvent (e: Event): void {
    e.stopPropagation()
    switch (e.type) {
      case 'click' :
        return this.handleClick(e)
      case 'mouseover' :
        return this.handleMouseOver(e as MouseEvent)
    }
  }

  handleClick (e: Event): void {
    const el = e.target as HTMLElement
    const eType = el.dataset.event
    switch (eType) {
      case 'zoom-in' : return this.model.fireZoom(true)
      case 'zoom-out' : return this.model.fireZoom(false)
    }
  }

  handleMouseOver (e: MouseEvent): void {
    const el = e.target as HTMLElement
    if (el.closest('.chart-tooltip') == null) return
    const legendItem = el.closest('.legendItem')
    if (legendItem instanceof HTMLElement) return this.handleMouseOverLegendItem(legendItem, e)
    const segment = el.closest('g')
    if (segment instanceof HTMLElement) return this.handleMouseOverSegment(segment, e)
  }

  /**
   * Handle mouseover event over legend item.
   * It triggers the highlight of the segments belonging to the legend item.
   * @param legendItem - the legend item that was hovered over
   * @param e
   */
  handleMouseOverLegendItem (legendItem: HTMLElement, e: MouseEvent): void {

  }

  /**
   * Handle mouseover event over chart segment.
   * It triggers the tooltip to show and redraw in the correct position based on the mouse position.
   * @param segment - the segment that was hovered over
   * @param e
   */
  handleMouseOverSegment (segment: HTMLElement, e: MouseEvent): void {
    const segmentId = Number(segment.dataset.id)
    if (segmentId == null) return

    const wrap = segment.closest('.barwrap')
    if (!(wrap instanceof HTMLElement)) return

    const participantId = Number(wrap.dataset.id)
    if (participantId == null) return

    const WIDTH_OF_TOOLTIP = 155
    const y = segment.getBoundingClientRect().bottom + window.scrollY - 1
    const widthOfView = window.scrollX + document.body.clientWidth
    const x = e.pageX + WIDTH_OF_TOOLTIP > widthOfView ? widthOfView - WIDTH_OF_TOOLTIP : e.pageX

    this.model.tooltipComponent.controller.model.redraw(participantId, segmentId, x, y)
  }
}
