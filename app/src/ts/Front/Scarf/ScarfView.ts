import { AbstractView } from '../Common/AbstractView'
import { ScarfController } from './ScarfController'
import { AxisBreaks, ScarfFilling, ScarfParticipant, ScarfSegment, ScarfStimuliInfo, ScarfStyling } from './ScarfModel'

export class ScarfView extends AbstractView {
  controller: ScarfController
  el: HTMLElement
  observerType: string = 'scarf-view'

  constructor (controller: ScarfController) {
    super()
    this.controller = controller
    this.el = this.#createElement()
    this.controller.model.addObserver(this)
    this.registerEventListeners(this.el, ['click', 'change', 'dblclick', 'mouseover', 'mouseleave'])
    this.getElement('.tooltip-area').append(this.controller.model.tooltipComponent.el)
  }

  handleUpdate (msg: string): void {
    switch (msg) {
      case 'zoom': return this.#fireZoom()
      case 'timeline': return this.#fireTimelineChange()
      case 'stimulus' : return this.#fireStimulusChange()
      case 'highlight': return this.#fireHighlight()
    }
    super.handleUpdate(msg)
  }

  /**
   * Animate zooming in and out
   * @private
   */
  #fireZoom (): void {
    const model = this.controller.model
    const animateTag = this.el.getElementsByTagName('animate')[0]
    animateTag.setAttribute('from', `${model.zoomFrom}%`)
    animateTag.setAttribute('to', `${model.zoomTo}%`)
    animateTag.beginElement()
  }

  /**
   * Animate timeline change
   * @private
   */
  #fireTimelineChange (): void {
    const model = this.controller.model
    const animateTag = this.el.getElementsByTagName('animate')
    for (let i = 1; i < animateTag.length; i++) {
      const participantId = Number(animateTag[i].closest('.barwrap')?.getAttribute('data-id'))
      if (isNaN(participantId)) throw new Error('Participant id is not a number')
      animateTag[i].setAttribute('from', model.getParticipantFromWidth(participantId))
      animateTag[i].setAttribute('to', model.getParticipantToWidth(participantId))
      animateTag[i].beginElement()
    }
    this.getElement('.btn3').classList.toggle('is-active')
    this.getElement('.chxlabs').innerHTML = this.#createXAxisLabelsInnerHtml(model.getTimeline())
    this.getElement('pattern').setAttribute('width', model.getPatternWidth())
    this.getElement('.chxlab').innerHTML = model.getXAxisLabel()
  }

  #fireStimulusChange (): void {
    this.getElement('.btn3').classList.remove('is-active')
    this.getElement('.chartwrap').innerHTML = this.#createInnerPlotInnerHtml(this.controller.model.getData())
  }

  #fireHighlight (): void {
    const model = this.controller.model
    this.getElement('style').innerHTML = this.#createHighlightStyleInnerHtml(model.highlightedType)
  }

  /**
   * Private method to create the scarf plot element
   * @private
   */
  #createElement (): HTMLElement {
    const el = document.createElement('div')
    el.className = 'anh anim scarf'
    el.innerHTML = this.#createWholePlotInnerHtml(this.controller.model.getData())
    return el
  }

  /**
   * Private method to create the inner HTML of the whole plot including buttons and stimuli select
   * @param data - the data to be plotted
   * @private
   */
  #createWholePlotInnerHtml (data: ScarfFilling): string {
    return `
    <style></style>
    <h3 class="cardtitle">Sequence chart (Scarf plot)</h3>
    <div class="btnholder">
    <select class="js-change">
          ${data.stimuli.map((x: ScarfStimuliInfo): string => {
          return `<option value="${x.id}">${x.name}</option>`
          }).join('')}
    </select>
    <div class="js-click btn3">
      <div class="btn3-absolute">Absolute timeline</div>
      <div class="btn3-relative">Relative timeline</div>
    </div>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="js-click svg-icon bi-zoom-in" viewBox="0 0 16 16">
        <path fill-rule="evenodd" d="M6.5 12a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM13 6.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z"/>
        <path d="M10.344 11.742c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1 6.538 6.538 0 0 1-1.398 1.4z"/>
        <path fill-rule="evenodd" d="M6.5 3a.5.5 0 0 1 .5.5V6h2.5a.5.5 0 0 1 0 1H7v2.5a.5.5 0 0 1-1 0V7H3.5a.5.5 0 0 1 0-1H6V3.5a.5.5 0 0 1 .5-.5z"/>
      </svg>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="js-click svg-icon bi-zoom-out" viewBox="0 0 16 16">
        <path fill-rule="evenodd" d="M6.5 12a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM13 6.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z"/>
        <path d="M10.344 11.742c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1 6.538 6.538 0 0 1-1.398 1.4z"/>
        <path fill-rule="evenodd" d="M3 6.5a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1h-6a.5.5 0 0 1-.5-.5z"/>
      </svg>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="js-click svg-icon bi-download" viewBox="0 0 16 16">
        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
        <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
      </svg>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="js-click svg-icon bi-wrench" viewBox="0 0 16 16">
        <path d="M.102 2.223A3.004 3.004 0 0 0 3.78 5.897l6.341 6.252A3.003 3.003 0 0 0 13 16a3 3 0 1 0-.851-5.878L5.897 3.781A3.004 3.004 0 0 0 2.223.1l2.141 2.142L4 4l-1.757.364L.102 2.223zm13.37 9.019.528.026.287.445.445.287.026.529L15 13l-.242.471-.026.529-.445.287-.287.445-.529.026L13 15l-.471-.242-.529-.026-.287-.445-.445-.287-.026-.529L11 13l.242-.471.026-.529.445-.287.287-.445.529-.026L13 11l.471.242z"/>
      </svg>
    </div>
    <div class="tooltip-area js-mouseleave">
        <div class="js-mouseover chartwrap">
        ${this.#createInnerPlotInnerHtml(data)}
        </div>
    </div>`
  }

  /**
   * Private method to create the inner HTML of the interactive part of the chart (SVG, labels and legend)
   * @param data - the data to be plotted
   * @private
   */
  #createInnerPlotInnerHtml (data: ScarfFilling): string {
    const model = this.controller.model
    return `
    <style>
        ${data.stylingAndLegend.aoi.map(aoi => `rect.${aoi.identifier}{fill:${aoi.color}}`).join('')}
        ${data.stylingAndLegend.category.map(aoi => `rect.${aoi.identifier}{fill:${aoi.color}}`).join('')}
    </style>
    <div class='chylabs' style='grid-auto-rows:${data.heightOfBarWrap}px' data-gap='${data.heightOfBarWrap}'>
        ${data.participants.map((participant) => `<div>${participant.label}</div>`).join('')}
    </div>
    <div class='charea-holder'>
        <svg xmlns='http://www.w3.org/2000/svg' id='charea' width='100%' height='${data.chartHeight}'>
            <animate attributeName='width' from='100%' to='100%' dur='0.3s' fill='freeze'/>
            <defs>
                <pattern id='grid' width="${model.getPatternWidth()}"
                         height="${data.heightOfBarWrap}" patternUnits="userSpaceOnUse">
                    <rect fill='none' width='100%' height='100%' stroke='#cbcbcb' stroke-width='1'/>
                </pattern>
            </defs>
            <rect fill='url(#grid)' stroke='#cbcbcb' stroke-width='1' width='100%'
                  height='${data.chartHeight - 20}'/>
            <svg y='${data.chartHeight - 14}' class='chxlabs'>
                ${this.#createXAxisLabelsInnerHtml(data.timeline)}
            </svg>
            ${data.participants.map((participant, i) => this.#createChartLineOuterHtml(participant, i, data.heightOfBarWrap)).join('')}
        </svg>
    </div>
    <div class='chxlab'>
        ${model.getXAxisLabel()}
    </div>
    <div class="chlegendwrap">
        <div class="js-dblclick" data-event="open-modal" data-modal="edit-aoi">
            <div class='chlegendtitle'>
                Fixations
            </div>
            <div class='chlegend'>
                ${data.stylingAndLegend.aoi.map(aoi => this.#createLegendBasicItemOuterHtml(aoi)).join('')}
            </div>
        </div>
        <div class="js-dblclick">
            <div class='chlegendtitle'>
                Other segment categories
            </div>
            <div class='chlegend'>
                ${data.stylingAndLegend.category.map(category => this.#createLegendBasicItemOuterHtml(category)).join('')}
            </div>
        </div>
    </div>`
  }

  #createXAxisLabelsInnerHtml (timeline: AxisBreaks): string {
    let labels = '<text x=\'0\' text-anchor=\'start\'>0</text>'
    for (let i = 1; i < timeline.length - 1; i++) {
      const label = timeline[i] as number // TODO FIX
      labels += `<text x='${(label / timeline.maxLabel) * 100}%' text-anchor='middle'>${label}</text>`
    }
    labels += `<text x='100%' text-anchor='end'>${timeline.maxLabel}</text>`
    return labels
  }

  #createChartLineOuterHtml (participant: ScarfParticipant, i: number, barHeight: number): string {
    return `
    <svg class='barwrap' y='${i * barHeight}' data-id='${participant.id}' height='${barHeight}' width='${participant.width}'>
      <animate attributeName='width' from='0%' to='${participant.width}' dur='0.4s' fill='freeze'/>
      ${participant.segments.map((segment, id) => this.#createSegmentOuterHtml(segment, id)).join('')}
    </svg>`
  }

  #createSegmentOuterHtml (segment: ScarfSegment, id: number): string {
    return `
    <g data-id='${id}'>
    ${segment.content.map((content) => `<rect class='${content.identifier}' height='${content.height}' x='${content.x}' width='${content.width}' y='${content.y}'></rect>`).join('')}
    </g>`
  }

  #createLegendBasicItemOuterHtml (entity: ScarfStyling): string {
    return `
    <div class="${entity.identifier} legendItem">
        <svg width="12" height="${entity.height}">
            <rect class="${entity.identifier}" width="100%" height="100%" fill="${entity.color}"/>
        </svg>
        <div>
            ${entity.name}
        </div>
    </div>`
  }

  #createHighlightStyleInnerHtml (identifier: string | null): string {
    return (identifier === null) ? '' : `rect[class^='a']{opacity:0.2}rect.${identifier}{opacity:1;stroke:#0000007d}line[class^='a']{opacity:0.2}line.${identifier}{opacity:1;stroke-width:100%}`
  }
}
