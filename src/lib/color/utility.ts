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
  const normalizedValue = (value - minValue) / (maxValue - minValue)

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

/**
 * Scientific color palette optimized for data visualization and accessibility
 * Based on colorblind-friendly palettes with good contrast and distinctiveness
 */
export const SCIENTIFIC_COLOR_PALETTE = [
  '#1f77b4', // Blue - primary data color
  '#ff7f0e', // Orange - secondary data color
  '#2ca02c', // Green - tertiary data color
  '#d62728', // Red - attention/error color
  '#9467bd', // Purple - categorical data
  '#8c564b', // Brown - categorical data
  '#e377c2', // Pink - categorical data
  '#7f7f7f', // Gray - neutral data
  '#bcbd22', // Olive - categorical data
  '#17becf', // Cyan - categorical data
  '#aec7e8', // Light blue - background/light data
  '#ffbb78', // Light orange - background/light data
]

export type ColorFormat = 'hex' | 'rgb' | 'rgba' | 'invalid'

/**
 * Detects the format of a color string
 */
export function detectColorFormat(color: string): ColorFormat {
  if (!color) return 'invalid'

  // Trim whitespace
  const trimmed = color.trim()

  // Check for hex format (with or without #)
  if (/^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(trimmed)) {
    return 'hex'
  }

  // Check for rgb format
  if (/^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/.test(trimmed)) {
    return 'rgb'
  }

  // Check for rgba format
  if (
    /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([01]|0?\.\d+)\s*\)$/.test(trimmed)
  ) {
    return 'rgba'
  }

  return 'invalid'
}

/**
 * Converts hex color to RGB(A)
 */
export function hexToRgb(hex: string): {
  r: number
  g: number
  b: number
  a: number
} {
  // Remove # if present
  hex = hex.replace(/^#/, '')

  // Expand shorthand form (e.g., "03F") to full form (e.g., "0033FF")
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  }

  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  return { r, g, b, a: 1 }
}

/**
 * Converts RGB components to hex string
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map(x => {
        const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16)
        return hex.length === 1 ? '0' + hex : hex
      })
      .join('')
  )
}

/**
 * Parses RGB string to components
 */
export function parseRgb(
  rgb: string
): { r: number; g: number; b: number; a: number } | null {
  const rgbRegex = /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/
  const match = rgb.match(rgbRegex)

  if (match) {
    return {
      r: parseInt(match[1], 10),
      g: parseInt(match[2], 10),
      b: parseInt(match[3], 10),
      a: 1,
    }
  }

  return null
}

/**
 * Parses RGBA string to components
 */
export function parseRgba(
  rgba: string
): { r: number; g: number; b: number; a: number } | null {
  const rgbaRegex =
    /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([01]|0?\.\d+)\s*\)/
  const match = rgba.match(rgbaRegex)

  if (match) {
    return {
      r: parseInt(match[1], 10),
      g: parseInt(match[2], 10),
      b: parseInt(match[3], 10),
      a: parseFloat(match[4]),
    }
  }

  return null
}

/**
 * Converts any valid color string to hex
 */
export function convertToHex(color: string, defaultValue = '#000000'): string {
  const format = detectColorFormat(color)

  switch (format) {
    case 'hex': {
      let hex = color.replace(/^#/, '')
      if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
      }
      return '#' + hex
    }
    case 'rgb': {
      const rgb = parseRgb(color)
      if (rgb) {
        return rgbToHex(rgb.r, rgb.g, rgb.b)
      }
      break
    }
    case 'rgba': {
      const rgba = parseRgba(color)
      if (rgba) {
        return rgbToHex(rgba.r, rgba.g, rgba.b)
      }
      break
    }
  }

  return defaultValue
}

/**
 * Converts HSV to HSL
 */
export function hsvToHsl(
  h: number,
  s: number,
  v: number
): { h: number; s: number; l: number } {
  s = s / 100
  v = v / 100

  const l = v * (1 - s / 2)
  const newS = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l)

  return {
    h,
    s: Math.round(newS * 100),
    l: Math.round(l * 100),
  }
}

/**
 * Converts HSL to HSV
 */
export function hslToHsv(
  h: number,
  s: number,
  l: number
): { h: number; s: number; v: number } {
  s = s / 100
  l = l / 100

  const v = l + s * Math.min(l, 1 - l)
  const newS = v === 0 ? 0 : 2 * (1 - l / v)

  return {
    h,
    s: Math.round(newS * 100),
    v: Math.round(v * 100),
  }
}

/**
 * Converts HSL to RGB
 */
export function hslToRgb(
  h: number,
  s: number,
  l: number
): { r: number; g: number; b: number } {
  h = Math.max(0, Math.min(360, h))
  s = Math.max(0, Math.min(100, s)) / 100
  l = Math.max(0, Math.min(100, l)) / 100

  if (s === 0) {
    const v = Math.round(l * 255)
    return { r: v, g: v, b: v }
  }

  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2

  let r = 0,
    g = 0,
    b = 0

  if (0 <= h && h < 60) {
    r = c
    g = x
    b = 0
  } else if (60 <= h && h < 120) {
    r = x
    g = c
    b = 0
  } else if (120 <= h && h < 180) {
    r = 0
    g = c
    b = x
  } else if (180 <= h && h < 240) {
    r = 0
    g = x
    b = c
  } else if (240 <= h && h < 300) {
    r = x
    g = 0
    b = c
  } else if (300 <= h && h < 360) {
    r = c
    g = 0
    b = x
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  }
}

/**
 * Converts RGB to HSL
 */
export function rgbToHsl(
  r: number,
  g: number,
  b: number
): { h: number; s: number; l: number } {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min

  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }

    h *= 60
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}
