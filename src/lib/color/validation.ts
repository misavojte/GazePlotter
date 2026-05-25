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
