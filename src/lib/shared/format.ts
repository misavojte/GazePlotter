/**
 * Human-readable formatting: numbers, byte sizes, durations.
 */

/**
 * Formats a number to a specific number of decimal places
 * Uses a rounding behavior that rounds 0.5 and above up
 *
 * @param value The number to format
 * @param decimalPlaces Number of decimal places (default: 1)
 * @returns Formatted number
 */
export function formatDecimal(
  value: number,
  decimalPlaces: number = 1
): number {
  const factor = Math.pow(10, decimalPlaces)
  return Math.round(value * factor) / factor
}

/**
 * Formats file size in bytes to human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const formatted = (bytes / Math.pow(k, i)).toFixed(2)
  // parseFloat is used here to trim trailing zeros (e.g., 1.00 -> 1)
  return parseFloat(formatted) + ' ' + sizes[i]
}

/**
 * Formats duration in milliseconds to human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(2)} seconds`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = (seconds % 60).toFixed(0)
  return `${minutes}m ${remainingSeconds}s`
}
