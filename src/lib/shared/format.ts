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

const SIZE_UNITS = ['Bytes', 'KB', 'MB', 'GB']

/** The unit a size reads best in. */
function sizeUnit(bytes: number): { divisor: number; label: string } {
  const power = bytes >= 1 ? Math.floor(Math.log(bytes) / Math.log(1024)) : 0
  const i = Math.min(power, SIZE_UNITS.length - 1)
  return { divisor: 1024 ** i, label: SIZE_UNITS[i] }
}

/**
 * Formats file size in bytes to human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const { divisor, label } = sizeUnit(bytes)
  // parseFloat trims trailing zeros (1.00 -> 1)
  return parseFloat((bytes / divisor).toFixed(2)) + ' ' + label
}

/**
 * A size still counting up, with one fixed decimal so its digits keep their
 * width: "1.2 MB", or against a total in the total's unit: "1.2 of 4.1 MB".
 */
export function formatSizeProgress(loaded: number, total: number | null): string {
  const { divisor, label } = sizeUnit(total ?? loaded)
  const digits = divisor === 1 ? 0 : 1
  const part = (bytes: number) => (bytes / divisor).toFixed(digits)
  return total === null
    ? `${part(loaded)} ${label}`
    : `${part(loaded)} of ${part(total)} ${label}`
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
