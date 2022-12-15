import { AbstractView } from '../Common/AbstractView'
import { ScarfController } from './ScarfController'
import { AxisBreaks, ScarfFilling, ScarfParticipant, ScarfSegment, ScarfStimuliInfo, ScarfStyling } from './ScarfModel'

export class ScarfView extends AbstractView {
  controller: ScarfController
  el: HTMLElement

  constructor (controller: ScarfController) {
    super()
    this.controller = controller
    this.el = this.#createElement()
    this.controller.model.addObserver(this)
    this.registerEventListeners(this.el, ['click', 'change', 'dblclick', 'mouseover', 'mouseleave'])
    this.el.querySelector('.tooltip-area')?.append(this.controller.model.tooltipComponent.el)
  }

  handleUpdate (msg: string): void {
    switch (msg) {
      case 'zoom': return this.#fireZoom()
      case 'timeline': return this.#fireTimelineChange()
      case 'stimulus' : return this.#fireStimulusChange()
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
      animateTag[i].setAttribute('from', model.getParticipantFromWidth(i - 1))
      animateTag[i].setAttribute('to', model.getParticipantToWidth(i - 1))
      animateTag[i].beginElement()
    }
    this.getElement('.btn3').classList.toggle('is-active')
    this.getElement('.chxlabs').innerHTML = this.#createXAxisLabelsInnerHtml(model.getTimeline())
    this.getElement('pattern').setAttribute('width', model.getPatternWidth())
    this.getElement('.scarf-timeline-unit').innerHTML = model.getTimelineUnit()
  }

  #fireStimulusChange (): void {
    this.getElement('.btn3').classList.remove('is-active')
    this.getElement('.chartwrap').innerHTML = this.#createInnerPlotInnerHtml(this.controller.model.getData())
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
    <h3 class="cardtitle">Sequence chart (Scarf plot)</h3>
    <div class="btnholder">
    <select class="js-change">
          ${data.stimuli.map((x: ScarfStimuliInfo): string => {
          return `<option value="${x.id}">${x.name}</option>`
          }).join('')}
    </select>
    <div class="js-click btn3" data-event="change-timeline">
      <div class="btn3-absolute">Absolute timeline</div>
      <div class="btn3-relative">Relative timeline</div>
    </div>
      <i class="js-click svg-icon bi bi-zoom-in" data-event="zoom-in"></i>
      <i class="js-click svg-icon bi bi-zoom-out" data-event="zoom-out"></i>
      <i class="js-click svg-icon bi bi-download" data-event="open-modal" data-modal="download-scarf" data-parameter="0"></i>
      <i class="js-click svg-icon bi bi-wrench" data-event="open-modal" data-modal="scarf-settings"></i>
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
    <div class='chylabs' style='grid-auto-rows:${data.heightOfBarWrap}px'>
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
        Elapsed time [<span class="scarf-timeline-unit">${model.getTimelineUnit()}</span>]
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
}
