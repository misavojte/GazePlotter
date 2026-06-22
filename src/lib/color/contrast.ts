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
