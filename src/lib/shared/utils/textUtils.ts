import { sumArray } from '$lib/shared/utils/mathUtils'

/**
 * Utility functions for text measurement and manipulation in SVG elements
 */

/**
 * Defines the shape of our helper function, including its
 * static 'context' property for caching.
 */
type MeasurementContextGetter = {
  (): CanvasRenderingContext2D | null;
  context: CanvasRenderingContext2D | null;
};

/**
 * A cached, singleton helper function to get a canvas 2D context.
 * This avoids creating a new canvas on every text measurement.
 */
const getMeasurementContext: MeasurementContextGetter = () => {
  // Check if we are in a browser environment
  if (typeof document === 'undefined') {
    return null; // Not in a browser
  }

  // Use the static 'context' property (now recognized by TypeScript)
  if (!getMeasurementContext.context) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    // Store the context on the function itself
    getMeasurementContext.context = context;
  }
  
  return getMeasurementContext.context;
};

// Initialize the static property
getMeasurementContext.context = null;

/**
 * The CSS font stack used by browsers to render the default system sans-serif font.
 * This ensures the canvas measurement uses the *same font* as the DOM
 * (e.g., San Francisco on Mac, Segoe UI on Windows).
 */
export const SYSTEM_SANS_SERIF_STACK = 
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

// --- Main Function ---

/**
* Estimates the width of a text string in pixels based on its content and font size,
* using the system's default sans-serif font.
* Note: This is a fast and reliable approximation using the Canvas API.
*
* @param text The text string to measure
* @param fontSize Font size in pixels
* @returns Estimated width in pixels
*/
export const estimateTextWidth = (text: string, fontSize: number, fontFamily: string = SYSTEM_SANS_SERIF_STACK): number => {
  const context = getMeasurementContext();

  if (context) {
    // Browser environment: Use the cached canvas context
    
    // Set the font properties
    // We hardcode "sans-serif" as requested.
    context.font = `${fontSize}px ${SYSTEM_SANS_SERIF_STACK}`; 
    
    // Measure the text
    const metrics = context.measureText(text);
    return metrics.width;
    
  } else {
    // Non-browser (e.g., Node.js/SSR) or context failure fallback.
    // This provides a *very* rough estimate.

    console.log('estimateTextWidth: Non-browser environment or context failure fallback. Returning rough estimate.')
    
    // '0.55' is an arbitrary average width for a sans-serif character
    // relative to the font size. 'W' is ~1.0, 'i' is ~0.2.
    const averageCharWidthFactor = 0.55;
    return text.length * fontSize * averageCharWidthFactor;
  }
};

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

/**
 * Truncates text to fit within a specified pixel width, adding ellipsis if needed
 *
 * @param text The text string to truncate
 * @param maxWidthPx Maximum width in pixels
 * @param fontSize Font size in pixels
 * @param fontFamily Font family (defaults to sans-serif)
 * @param ellipsis Ellipsis string to append (defaults to "...")
 * @returns Truncated text with ellipsis if necessary
 */
export function truncateTextToPixelWidth(
  text: string,
  maxWidthPx: number,
  fontSize: number = 12,
  fontFamily: string = 'sans-serif',
  ellipsis: string = '...'
): string {
  // If text is already shorter than max width, return it as is
  const originalWidth = estimateTextWidth(text, fontSize, fontFamily)
  if (originalWidth <= maxWidthPx) return text

  // Calculate ellipsis width
  const ellipsisWidth = estimateTextWidth(ellipsis, fontSize, fontFamily)

  // Available width for text content
  const availableWidth = maxWidthPx - ellipsisWidth

  // If no room for any text plus ellipsis
  if (availableWidth <= 0) return ellipsis

  // Binary search for the optimal truncation point
  let low = 0
  let high = text.length

  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2)
    const truncated = text.substring(0, mid)
    const truncatedWidth = estimateTextWidth(truncated, fontSize, fontFamily)

    if (truncatedWidth <= availableWidth) {
      low = mid
    } else {
      high = mid - 1
    }
  }

  // Return the truncated text with ellipsis
  return text.substring(0, low) + ellipsis
}
