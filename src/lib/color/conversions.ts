import { detectColorFormat } from './validation'

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
function parseRgb(
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
function parseRgba(
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
  const sNormalized = s / 100
  const vNormalized = v / 100

  const lNormalized = vNormalized * (1 - sNormalized / 2)
  const newS =
    lNormalized === 0 || lNormalized === 1
      ? 0
      : (vNormalized - lNormalized) / Math.min(lNormalized, 1 - lNormalized)

  return {
    h,
    s: Math.round(newS * 100),
    l: Math.round(lNormalized * 100),
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
  const sNormalized = s / 100
  const lNormalized = l / 100

  const vNormalized =
    lNormalized + sNormalized * Math.min(lNormalized, 1 - lNormalized)
  const newS = vNormalized === 0 ? 0 : 2 * (1 - lNormalized / vNormalized)

  return {
    h,
    s: Math.round(newS * 100),
    v: Math.round(vNormalized * 100),
  }
}

/**
 * Converts HSL to RGB
 * Handles hue wrapping [0, 360] and ensures precision.
 */
export function hslToRgb(
  h: number,
  s: number,
  l: number
): { r: number; g: number; b: number } {
  // Normalize hue to [0, 360) for calculation, but handle 360 specifically
  const hCalc = h === 360 ? 0 : ((h % 360) + 360) % 360

  const sNorm = Math.max(0, Math.min(100, s)) / 100
  const lNorm = Math.max(0, Math.min(100, l)) / 100

  if (sNorm === 0) {
    const v = Math.round(lNorm * 255)
    return { r: v, g: v, b: v }
  }

  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm
  const x = c * (1 - Math.abs(((hCalc / 60) % 2) - 1))
  const m = lNorm - c / 2

  let r = 0,
    g = 0,
    b = 0

  if (0 <= hCalc && hCalc < 60) {
    ;[r, g, b] = [c, x, 0]
  } else if (60 <= hCalc && hCalc < 120) {
    ;[r, g, b] = [x, c, 0]
  } else if (120 <= hCalc && hCalc < 180) {
    ;[r, g, b] = [0, c, x]
  } else if (180 <= hCalc && hCalc < 240) {
    ;[r, g, b] = [0, x, c]
  } else if (240 <= hCalc && hCalc < 300) {
    ;[r, g, b] = [x, 0, c]
  } else if (300 <= hCalc && hCalc < 360) {
    ;[r, g, b] = [c, 0, x]
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
  const rNorm = r / 255
  const gNorm = g / 255
  const bNorm = b / 255

  const max = Math.max(rNorm, gNorm, bNorm)
  const min = Math.min(rNorm, gNorm, bNorm)
  const d = max - min

  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)
        break
      case gNorm:
        h = (bNorm - rNorm) / d + 2
        break
      case bNorm:
        h = (rNorm - gNorm) / d + 4
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
