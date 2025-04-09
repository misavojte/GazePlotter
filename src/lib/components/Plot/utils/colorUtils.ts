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
  // Parse hex colors
  const r1 = parseInt(color1.slice(1, 3), 16)
  const g1 = parseInt(color1.slice(3, 5), 16)
  const b1 = parseInt(color1.slice(5, 7), 16)

  const r2 = parseInt(color2.slice(1, 3), 16)
  const g2 = parseInt(color2.slice(3, 5), 16)
  const b2 = parseInt(color2.slice(5, 7), 16)

  // Interpolate
  const r = Math.round(r1 + factor * (r2 - r1))
  const g = Math.round(g1 + factor * (g2 - g1))
  const b = Math.round(b1 + factor * (b2 - b1))

  // Convert back to hex
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

/**
 * Generates a color for a value based on a color scale
 * @param value - The numeric value to get a color for
 * @param maxValue - Maximum possible value for normalization
 * @param colorScale - Array of two hex colors representing min and max colors
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
  const normalizedValue = (value - minValue) / (maxValue - minValue)

  // Use interpolation to get the color
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
  const gradient: string[] = []

  for (let i = 0; i < steps; i++) {
    const factor = i / (steps - 1)
    gradient.push(interpolateColor(colorStart, colorEnd, factor))
  }

  return gradient
}

/**
 * Determines if a color is light or dark
 * @param hexColor - Hex color to evaluate
 * @returns boolean - true if the color is dark, false if light
 */
export function isDarkColor(hexColor: string): boolean {
  // Parse hex color
  const r = parseInt(hexColor.slice(1, 3), 16)
  const g = parseInt(hexColor.slice(3, 5), 16)
  const b = parseInt(hexColor.slice(5, 7), 16)

  // Calculate perceived brightness using the formula
  // (0.299*R + 0.587*G + 0.114*B)
  const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  // Return true if the color is dark
  return brightness < 0.5
}

/**
 * Gets appropriate text color (black or white) for a background color
 * @param backgroundColor - Hex color of the background
 * @returns '#000000' for light backgrounds, '#FFFFFF' for dark backgrounds
 */
export function getContrastTextColor(backgroundColor: string): string {
  return isDarkColor(backgroundColor) ? '#FFFFFF' : '#000000'
}
