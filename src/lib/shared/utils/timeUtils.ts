/**
 * Formats duration in milliseconds to human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}\u00A0ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(2)}\u00A0seconds`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = (seconds % 60).toFixed(0)
  return `${minutes}m\u00A0${remainingSeconds}s`
}
