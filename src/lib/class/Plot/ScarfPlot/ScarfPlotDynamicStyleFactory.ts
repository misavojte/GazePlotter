import type {
  SingleStylingScarfFillingType,
  StylingScarfFillingType,
} from '$lib/type/Filling/ScarfFilling/index.ts'

/**
 * Class that generates dynamic CSS for SVG segments in scarf plot.
 * They are not styled directly in the component, because there are too many of them.
 * Instead, they are styled dynamically by adding CSS rules to the document.
 * This prevents performance issues when number of segments cca > 10000.
 */
export class ScarfPlotDynamicStyleFactory {
  readonly plotAreaId: string
  constructor(plotAreaId: string) {
    this.plotAreaId = plotAreaId
  }

  /**
   * Creates a valid CSS rule in the given plot area (valid within the id of the plot area)
   * @param selector CSS selector within the plot area
   * @param properties CSS properties
   * @returns valid CSS rule in the given plot area
   */
  generateCssRule(selector: string, properties: string): string {
    return `#${this.plotAreaId} ${selector}{${properties}}`
  }

  /**
   * Creates a valid CSS for a single rect SVG element
   * @param stylingType single item of styling data
   * @returns CSS rule for a single rect SVG element
   */
  generateRectCss(stylingType: SingleStylingScarfFillingType): string {
    const { color, identifier } = stylingType
    const selector = `.${identifier}`
    const properties = `fill:${color};`
    return this.generateCssRule(selector, properties)
  }

  /**
   * Creates a valid CSS for a single line SVG element
   * @param stylingType single item of styling data
   * @returns CSS rule for a single line SVG element
   */
  generateLineCss(stylingType: SingleStylingScarfFillingType): string {
    const { color, identifier, height } = stylingType
    const selector = `.${identifier}`
    const properties = `stroke:${color};stroke-width:${height};stroke-dasharray:1;`
    return this.generateCssRule(selector, properties)
  }

  /**
   * Creates a valid CSS for situation when elements with given class identifier are highlighted
   * @param highlightedType class identifier of the highlighted elements
   * @returns CSS modification rule when highlighting active
   */
  generateHighlightCss(highlightedType: string | null): string {
    if (highlightedType === null) {
      return ''
    }
    const hiddenRectsCss = this.generateCssRule(
      `rect:not(.${highlightedType})`,
      'opacity:0.2;'
    )
    const hiddenLinesCss = this.generateCssRule(
      `line:not(.${highlightedType})`,
      'opacity:0.2;'
    )
    const extraHighlightedLineCss = this.generateCssRule(
      `line.${highlightedType}`,
      'stroke-width:100%;'
    )

    return hiddenRectsCss + hiddenLinesCss + extraHighlightedLineCss
  }

  /**
   * Main method of the class. Generates dynamic CSS for scarf plot.
   * @param stylingData Given styling data from ScarfFillingFactory
   * @param highlightedType CSS class identifier of the highlighted elements
   * @returns dynamic CSS for scarf plot in the form of <style> tag
   */
  generateCss(
    stylingData: StylingScarfFillingType,
    highlightedType: string | null
  ): string {
    const { aoi, category, visibility } = stylingData
    const stylingRectTypes = [...aoi, ...category]
    const stylingLineTypes = [...visibility]

    const cssRects = stylingRectTypes
      .map(stylingType => {
        return this.generateRectCss(stylingType)
      })
      .join('')
    const cssLines = stylingLineTypes
      .map(stylingType => {
        return this.generateLineCss(stylingType)
      })
      .join('')
    const cssHighlight = this.generateHighlightCss(highlightedType)

    return '<style>' + cssRects + cssLines + cssHighlight + '</style>'
  }
}
