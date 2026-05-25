/**
 * Interpolates between two hex colors
 * @param color1 - Starting hex color (e.g., '#FFFFFF')
 * @param color2 - Ending hex color (e.g., '#000000')
 * @param factor - Interpolation factor between 0 and 1
 * @returns Interpolated hex color
 */
export function interpolateColor(
  color1: string,
  color2: string,
  factor: number
): string {
  if (factor <= 0) return color1
  if (factor >= 1) return color2

  // Parse hex colors once and interpolate
  // Using a slightly more efficient parsing approach if it's always #RRGGBB
  const r1 = parseInt(color1.substring(1, 3), 16)
  const g1 = parseInt(color1.substring(3, 5), 16)
  const b1 = parseInt(color1.substring(5, 7), 16)

  const r2 = parseInt(color2.substring(1, 3), 16)
  const g2 = parseInt(color2.substring(3, 5), 16)
  const b2 = parseInt(color2.substring(5, 7), 16)

  const r = Math.round(r1 + factor * (r2 - r1))
  const g = Math.round(g1 + factor * (g2 - g1))
  const b = Math.round(b1 + factor * (b2 - b1))

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

/**
 * Generates a color for a value based on a color scale
 * @param value - The numeric value to get a color for
 * @param minValue - Minimum possible value for normalization
 * @param maxValue - Maximum possible value for normalization
 * @param colorScale - Array of two or three hex colors representing min, (middle), and max colors
 * @returns Hex color corresponding to the value
 */
export function getColorForValue(
  value: number,
  minValue: number,
  maxValue: number,
  colorScale: string[]
): string {
  // Handle zero and null cases
  if (value === 0 || maxValue === 0) return colorScale[0]

  // Normalize value to get factor between 0 and 1
  // Guard against division by zero if min/max are equal
  const normalizedValue =
    maxValue === minValue ? 0 : (value - minValue) / (maxValue - minValue)

  // Handle three-color scale (min, middle, max)
  if (colorScale.length === 3) {
    // Determine if we're in the first or second half of the gradient
    if (normalizedValue <= 0.5) {
      // First half: interpolate between first and second color (min and middle)
      return interpolateColor(colorScale[0], colorScale[1], normalizedValue * 2)
    } else {
      // Second half: interpolate between second and third color (middle and max)
      return interpolateColor(
        colorScale[1],
        colorScale[2],
        (normalizedValue - 0.5) * 2
      )
    }
  }

  // Default two-color scale (min, max)
  return interpolateColor(colorScale[0], colorScale[1], normalizedValue)
}

/**
 * Generates a gradient color array between two colors
 * @param colorStart - Starting hex color (e.g., '#FFFFFF')
 * @param colorEnd - Ending hex color (e.g., '#000000')
 * @param steps - Number of color steps to generate
 * @returns Array of hex colors
 */
export function createColorGradient(
  colorStart: string,
  colorEnd: string,
  steps: number
): string[] {
  if (steps <= 1) return steps === 1 ? [colorStart] : []

  return Array.from({ length: steps }, (_, i) =>
    interpolateColor(colorStart, colorEnd, i / (steps - 1))
  )
}

/**
 * Mixes a generic hex color with white by a given amount (0-1).
 * Used for "de-highlighting" by desaturating/lightening rather than opacity.
 * @param hex The color hex code (e.g. #ff0000 or #f00)
 * @param amount The amount to mix with white (0 = original color, 1 = white)
 */
export function desaturateToWhite(hex: string, amount: number): string {
  // Handle short hex
  let c = hex.replace('#', '')
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2]
  }

  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)

  const newR = Math.round(r + (255 - r) * amount)
  const newG = Math.round(g + (255 - g) * amount)
  const newB = Math.round(b + (255 - b) * amount)

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`
}
