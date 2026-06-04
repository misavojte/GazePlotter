/**
 * Utility functions for text measurement and manipulation in SVG elements
 */

/**
 * Defines the shape of our helper function, including its
 * static 'context' property for caching.
 */
// --- Caching for Performance ---

/**
 * Cache for Canvas contexts per unique font string.
 * Keeping a context per font avoids the overhead of setting ctx.font,
 * which can be a bottleneck when measuring many strings.
 */
const contextCache = new Map<string, CanvasRenderingContext2D>()

/**
 * Cache for measured text widths.
 * Memoizing measurements avoids expensive Canvas API calls altogether
 * for frequently reused strings (like participant labels).
 */
const widthCache = new Map<string, number>()

/**
 * The CSS font stack used by browsers to render the default system sans-serif font.
 * This ensures the canvas measurement uses the *same font* as the DOM
 * (e.g., San Francisco on Mac, Segoe UI on Windows).
 */
export const SYSTEM_SANS_SERIF_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

/**
 * Estimates the width of a text string in pixels based on its content and font size,
 * using a specified or default font family.
 *
 * This implementation is highly optimized with:
 * 1. Memoization of measurement results
 * 2. Per-font context caching to avoid font reassignment overhead
 *
 * @param text The text string to measure
 * @param fontSize Font size in pixels
 * @param fontFamily Font family defaults to system sans-serif stack
 * @returns Width in pixels
 */
export const estimateTextWidth = (
  text: string,
  fontSize: number,
  fontFamily: string = SYSTEM_SANS_SERIF_STACK
): number => {
  // Use "sans-serif" as default if generic request
  const family =
    fontFamily === 'sans-serif' ? SYSTEM_SANS_SERIF_STACK : fontFamily
  const fontKey = `${fontSize}px ${family}`
  // 1. Fast path: Memoization lookup
  // Construct cache key without template literal to reduce allocation churn in hot loops
  const cacheKey = fontKey + '|' + text

  const cachedWidth = widthCache.get(cacheKey)
  if (cachedWidth !== undefined) return cachedWidth

  // 2. Performance: Browser environment measurement
  if (typeof document !== 'undefined') {
    let ctx = contextCache.get(fontKey)

    if (!ctx) {
      const canvas = document.createElement('canvas')
      const newCtx = canvas.getContext('2d')
      if (newCtx) {
        newCtx.font = fontKey
        contextCache.set(fontKey, newCtx)
        ctx = newCtx
      }
    }

    if (ctx) {
      const metrics = ctx.measureText(text)
      const width = metrics.width

      // Store in memoization cache
      // Simple cap to prevent unbounded growth in very dynamic apps
      if (widthCache.size < 5000) {
        widthCache.set(cacheKey, width)
      }

      return width
    }
  }

  // 3. Fallback path: SSR or context failure
  // '0.55' is an arbitrary average width for a sans-serif character relative to fontSize
  const averageCharWidthFactor = 0.55
  return text.length * fontSize * averageCharWidthFactor
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

  const totalWidth = widths.reduce((sum, w) => sum + w, 0)
  const maxWidth = widths.reduce((max, w) => (w > max ? w : max), 0)
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

/**
 * Measures the actual height of a text string using Canvas API.
 * Falls back to estimated height if in SSR or if canvas is not available.
 *
 * @param text The text string to measure
 * @param fontSize Font size in pixels
 * @param fontFamily Font family defaults to system sans-serif stack
 * @returns Height in pixels
 */
export function measureTextHeight(
  text: string,
  fontSize: number,
  fontFamily: string = SYSTEM_SANS_SERIF_STACK
): number {
  if (typeof document !== 'undefined') {
    const fontKey = `${fontSize}px ${fontFamily}`
    let ctx = contextCache.get(fontKey)

    if (!ctx) {
      const canvas = document.createElement('canvas')
      const newCtx = canvas.getContext('2d')
      if (newCtx) {
        newCtx.font = fontKey
        contextCache.set(fontKey, newCtx)
        ctx = newCtx
      }
    }

    if (ctx && text) {
      const metrics = ctx.measureText(text)
      const ascent = metrics.actualBoundingBoxAscent
      const descent = metrics.actualBoundingBoxDescent
      if (Number.isFinite(ascent) && Number.isFinite(descent)) {
        return ascent + descent
      }
    }
  }

  return fontSize
}
