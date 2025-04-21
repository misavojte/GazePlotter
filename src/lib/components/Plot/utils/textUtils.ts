import { sumArray } from '$lib/utils/mathUtils'

/**
 * Utility functions for text measurement and manipulation in SVG elements
 */

/**
 * Estimates the width of a text string in pixels based on its content, font size and font family
 * Note: This is an approximation since actual text rendering can vary
 *
 * @param text The text string to measure
 * @param fontSize Font size in pixels
 * @param fontFamily Font family (defaults to sans-serif)
 * @returns Estimated width in pixels
 */
export function estimateTextWidth(
  text: string,
  fontSize: number = 12,
  fontFamily: string = 'sans-serif'
): number {
  // Character width approximations for common font families
  const charWidthFactors: Record<string, number> = {
    'sans-serif': 0.6,
    serif: 0.65,
    monospace: 0.6,
    arial: 0.58,
    helvetica: 0.58,
    verdana: 0.62,
  }

  // Use the specific font factor or default to sans-serif
  const fontFactor =
    charWidthFactors[fontFamily.toLowerCase()] || charWidthFactors['sans-serif']

  // Width factors for different character types
  const charWidths = {
    narrow: 0.5, // i, l, t, etc.
    normal: 1.0, // a, b, c, etc.
    wide: 1.2, // m, w, etc.
    extraWide: 1.7, // emojis, CJK characters
  }

  // Define character sets
  const narrowChars = /[ijl!,.:;|'"()]/
  const wideChars = /[mwABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%&*+-=<>?_~]/
  const extraWideChars = /[\u3000-\u9FFF\uFF00-\uFFEF\u{1F300}-\u{1F64F}]/u

  let totalWidth = 0

  // Calculate total width based on character types
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (narrowChars.test(char)) {
      totalWidth += charWidths.narrow
    } else if (wideChars.test(char)) {
      totalWidth += charWidths.wide
    } else if (extraWideChars.test(char)) {
      totalWidth += charWidths.extraWide
    } else {
      totalWidth += charWidths.normal
    }
  }

  // Apply font size and font family factors
  return totalWidth * fontSize * fontFactor
}

/**
 * Calculates text metrics for an array of strings
 *
 * @param texts Array of text strings to measure
 * @param fontSize Font size in pixels
 * @param fontFamily Font family (defaults to sans-serif)
 * @returns Object with various text metrics
 */
export function calculateTextMetrics(
  texts: string[],
  fontSize: number = 12,
  fontFamily: string = 'sans-serif'
): {
  widths: number[]
  maxWidth: number
  averageWidth: number
  totalWidth: number
} {
  if (!texts.length) {
    return { widths: [], maxWidth: 0, averageWidth: 0, totalWidth: 0 }
  }

  const widths = texts.map(text =>
    estimateTextWidth(text, fontSize, fontFamily)
  )
  const maxWidth = Math.max(...widths)
  const totalWidth = sumArray(widths)
  const averageWidth = totalWidth / widths.length

  return {
    widths,
    maxWidth,
    averageWidth,
    totalWidth,
  }
}

/**
 * Calculates the optimal offset for axis labels based on text content
 *
 * @param labels Array of label texts
 * @param fontSize Font size in pixels
 * @param baseOffset Minimum offset to maintain
 * @param pixelPerChar Additional pixels per character to add (for padding)
 * @returns Calculated offset in pixels
 */
export function calculateLabelOffset(
  labels: string[],
  fontSize: number = 12,
  baseOffset: number = 0
): number {
  if (!labels.length) return baseOffset

  const { maxWidth } = calculateTextMetrics(labels, fontSize)

  // Add some padding based on the maximum text width
  return baseOffset + maxWidth
}
