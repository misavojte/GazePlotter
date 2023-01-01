import { AbstractDownloader } from './AbstractDownloader'

export class ScarfDownloader extends AbstractDownloader {
  minimalWidth: number = 300
  width: number
  height: number
  fileType: '.jpg' | '.png' | '.svg' | '.webp'
  fileName: string
  staticSvg: SVGElement

  constructor (fileName: string, fileType: string, width: number, el: HTMLElement) {
    super()
    if (Number(width) < this.minimalWidth) throw new Error(`Minimal width is ${this.minimalWidth}`)
    if (fileType !== '.svg' && fileType !== '.png' && fileType !== '.jpg' && fileType !== '.webp') throw new Error('File type not supported')
    this.width = width
    this.fileType = fileType
    this.fileName = fileName
    el.style.width = `${width}px`
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    this.height = el.offsetHeight
    svg.setAttribute('width', el.offsetWidth.toString())
    svg.setAttribute('height', this.height.toString())
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    svg.innerHTML = this.#createInnerHtml(el)
    this.staticSvg = svg
    el.style.width = ''
  }

  async download (): Promise<void> {
    return await new Promise((resolve) => {
      void this.buildContent().then(content => {
        super.triggerDownload(content, this.fileName, this.fileType)
        resolve()
      })
    })
  }

  async buildContent (): Promise<string> {
    return await new Promise(resolve => {
      const svgUrl = this.#getSvgUrl(this.staticSvg)
      if (this.fileType !== '.svg') {
        void this.#getRasterCanvasUrl(svgUrl).then(rasterUrl => {
          resolve(rasterUrl)
        })
      } else {
        resolve(svgUrl)
      }
    })
  }

  #getSvgUrl (svg: SVGElement): string {
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml;charset=utf-8' })
    const pageURL = window.URL // || window.webkitURL || window
    return pageURL.createObjectURL(blob)
  }

  async #getRasterCanvasUrl (svgUrl: string): Promise<string> {
    const width = this.width
    const height = this.height

    // prepare canvas
    const canvas = document.createElement('canvas')

    // set display size
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    // set resolution size
    const scale = 2
    canvas.width = width * scale
    canvas.height = height * scale

    const ctx = canvas.getContext('2d')
    if (ctx == null) throw new Error('Canvas context is null')

    // adjust coordinates to resolution size
    ctx.scale(scale, scale)
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const chartAreaImg = new Image()
    chartAreaImg.src = svgUrl

    return await new Promise((resolve) => {
      chartAreaImg.onload = () => {
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(chartAreaImg, 0, 0, width, height)
        resolve(canvas.toDataURL())
      }
    })
  }

  #createInnerHtml (el: HTMLElement): string {
    const styleInnerHtml = el.querySelector('style')?.innerHTML
    if (styleInnerHtml == null) throw new Error('No style found')
    return `
        <style><![CDATA[${styleInnerHtml}text{alignment-baseline:hanging;font-size:14px}.chxlabs text{font-size:11px}.chylabs text{alignment-baseline:middle}.chltitles text{text-anchor:middle;text-transform:uppercase;font-size:11px}.chlitems text{alignment-baseline:middle}]]></style>
        ${this.#createParticipantLabelsHtml(el)}
        ${this.#createSvgChartArea(el)}
        ${this.#createXAxisLabels(el)}
        ${this.#createLegendTitles(el)}
        ${this.#createLegendItems(el)}`
  }

  #createParticipantLabelsHtml (el: HTMLElement): string {
    const htmlCollection = el.querySelector('.chylabs')?.children
    if (htmlCollection == null) throw new Error('No participant labels found')
    const gap = Number(el.querySelector('.chylabs')?.getAttribute('data-gap'))
    let yPos = gap / 2
    let result = ''
    for (let i = 0; i < htmlCollection.length; i++) {
      const content = htmlCollection[i].innerHTML
      result += `<text y="${yPos}">${content}</text>`
      yPos += gap
    }
    return `<g class="chylabs">${result}</g>`
  }

  #createSvgChartArea (el: HTMLElement): string {
    const svgArea = el.querySelector('.charea-holder') as HTMLElement
    const leftOffset = svgArea.offsetLeft
    const svgAreaClone = svgArea.cloneNode(true) as HTMLElement
    const animateTags = svgAreaClone.getElementsByTagName('animate')
    while (animateTags.length > 0) {
      animateTags[0].remove()
    }
    return `<svg x="${leftOffset}" width="${el.offsetWidth - leftOffset}">${svgAreaClone.innerHTML}</svg>`
  }

  #createXAxisLabels (el: HTMLElement): string {
    const htmlLab = el.querySelector('.chxlab') as HTMLElement
    return `<text x="50%" y="${htmlLab.offsetTop}" text-anchor="middle">${htmlLab.innerText}</text>`
  }

  #createLegendTitles (el: HTMLElement): string {
    const htmlTitles = el.getElementsByClassName('chlegendtitle')
    let result = ''
    for (let i = 0; i < htmlTitles.length; i++) {
      const titleElement = htmlTitles[i] as HTMLElement
      result += `<text x="50%" y="${titleElement.offsetTop}">${titleElement.innerHTML}</text>`
    }
    return `<g class="chltitles">${result}</g>`
  }

  #createLegendItems (el: HTMLElement): string {
    const htmlItems = el.getElementsByClassName('legendItem')
    let result = ''
    for (let i = 0; i < htmlItems.length; i++) {
      const legendElement = htmlItems[i] as HTMLElement
      const symbol = legendElement.children[0] as SVGSVGElement
      const text = legendElement.children[1]
      const rectX = symbol.getBoundingClientRect().left - legendElement.getBoundingClientRect().left
      const rectY = symbol.getBoundingClientRect().top - legendElement.getBoundingClientRect().top
      const textX = text.getBoundingClientRect().left - legendElement.getBoundingClientRect().left
      result += `
            <svg x="${legendElement.offsetLeft}" y="${legendElement.offsetTop}" width="${legendElement.offsetWidth}" height="${legendElement.offsetHeight}">
            <svg x="${rectX}" y="${rectY - 2}" width="${symbol.width.baseVal.valueInSpecifiedUnits}" height="${symbol.height.baseVal.valueInSpecifiedUnits}">${symbol.innerHTML}</svg>
            <text x="${textX}" y="50%" alignment-baseline="middle">${text.innerHTML}</text>
            </svg>`
    }
    return `<g class="chlitems">${result}</g>`
  }
}
