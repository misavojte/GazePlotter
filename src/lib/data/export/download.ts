/**
 * Make a user- or plot-derived string safe as a file name (download or zip
 * entry): strips path separators, reserved characters, and control characters,
 * then collapses whitespace.
 */
export function sanitizeFileName(name: string): string {
  const cleaned = name
    // eslint-disable-next-line no-control-regex
    .replace(/[/\\:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.length > 0 ? cleaned : 'untitled'
}

/**
 * Trigger a browser download of a blob or string content.
 */
export function triggerDownload(
  content: string | Blob,
  fileName: string,
  extension: string
): void {
  const finalFileName = fileName.endsWith(extension)
    ? fileName
    : fileName + extension

  // If content is already a blob URL string, just use it
  if (typeof content === 'string' && content.startsWith('blob:')) {
    const link = document.createElement('a')
    link.href = content
    link.download = finalFileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    return
  }

  // Create a blob from string or use existing blob
  const blob =
    typeof content === 'string'
      ? new Blob([content], { type: 'text/plain' })
      : content

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = finalFileName
  document.body.appendChild(link)
  link.click()
  link.remove()

  // Clean up
  setTimeout(() => URL.revokeObjectURL(url), 100)
}
