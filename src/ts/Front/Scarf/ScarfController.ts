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
      case 'mouseleave' :
        return this.handleMouseLeave()
      case 'change' :
        return this.handleChange(e)
      case 'dblclick' :
        return this.handleDblClick(e)
    }
  }

  /** Decide what to do when a click event occurs
   * @param e - the click event
   */
  handleClick (e: Event): void {
    const el = e.currentTarget as HTMLElement
    const hasClass = (name: string): boolean => el.classList.contains(name)
    if (hasClass('bi-zoom-in')) return this.model.fireZoom(true)
    if (hasClass('bi-zoom-out')) return this.model.fireZoom(false)
    if (hasClass('bi-wrench')) return this.model.fireOpenSettings()
    if (hasClass('bi-download')) return this.model.fireDownload()
  }

  /** Decide what to do when mouseover event is triggered
   * @param e - the mouseover event
   */
  handleMouseOver (e: MouseEvent): void {
    const el = e.target as HTMLElement
    if (el.closest('.chart-tooltip') !== null) return
    const segment = el.closest('g')
    if (segment instanceof Element) return this.handleMouseOverSegment(segment, e)
    const legendItem = el.closest('.legendItem')
    if (legendItem instanceof HTMLElement) {
      this.handleMouseOverLegendItem(legendItem)
    } else {
      this.model.fireHighlight(null)
    }
    this.model.tooltipComponent.controller.model.hide()
  }

  handleMouseLeave (): void {
    this.model.tooltipComponent.controller.model.hide()
    this.model.fireHighlight(null)
  }

  /** On stimulus change, get stimulus id and update model */
  handleChange (e: Event): void {
    const el = e.currentTarget as HTMLInputElement
    if (el.classList.contains('timeline-switch')) {
      const timelineId = Number(el.value)
      this.model.fireTimelineChange(timelineId)
      return
    }
    const stimulusId = Number(el.value)
    this.model.fireNewStimulus(stimulusId)
  }

  /**
   * Handle mouseover event over legend item.
   * It triggers the highlight of the segments belonging to the legend item.
   * @param legendItem - the legend item that was hovered over
   */
  handleMouseOverLegendItem (legendItem: HTMLElement): void {
    const segmentIdentifier = legendItem.classList[0]
    if (segmentIdentifier === '') throw new Error('No segment identifier found in legend item')
    this.model.fireHighlight(segmentIdentifier)
  }

  /**
   * Handle mouseover event over chart segment.
   * It triggers the tooltip to show and redraw in the correct position based on the mouse position.
   * @param segment - the segment that was hovered over
   * @param e
   */
  handleMouseOverSegment (segment: Element, e: MouseEvent): void {
    const segmentId = this.#getId(segment)
    if (segmentId == null) return

    const wrap = segment.closest('.barwrap')
    if (!(wrap instanceof Element)) return

    const participantId = this.#getId(wrap)
    if (participantId == null) return

    const WIDTH_OF_TOOLTIP = 155
    const y = segment.getBoundingClientRect().bottom + window.scrollY - 1
    const widthOfView = window.scrollX + document.body.clientWidth
    const x = e.pageX + WIDTH_OF_TOOLTIP > widthOfView ? widthOfView - WIDTH_OF_TOOLTIP : e.pageX

    this.model.tooltipComponent.controller.model.redraw(participantId, segmentId, x, y)
  }

  handleDblClick (e: Event): void {
    const el = e.currentTarget as HTMLElement
    if (el.dataset.modal === 'edit-aoi') this.model.fireOpenAoiSettings()
  }

  /** Utility function to get the id of a segment or participant
   * @param element - the element to get the id from
   * @private
   */
  #getId (element: Element): number {
    return Number(element.getAttribute('data-id'))
  }
}
