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
    document.body.removeChild(link)
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
  document.body.removeChild(link)

  // Clean up
  setTimeout(() => URL.revokeObjectURL(url), 100)
}
