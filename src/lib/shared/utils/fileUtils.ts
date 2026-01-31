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
