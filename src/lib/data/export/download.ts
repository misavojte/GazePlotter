/**
 * Make a user- or plot-derived string safe as a file name (download or zip
 * entry): strips path separators, reserved characters, and control characters,
 * then collapses whitespace.
 */
export function sanitizeFileName(name: string): string {
  const cleaned = name
    .replace(/[/\\:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.length > 0 ? cleaned : 'untitled'
}

/** The `saveFile` embedding option. `fileName` arrives with the extension
 *  applied; `extension` is separate for save-dialog filters. */
export type SaveFile = (
  content: string | Blob,
  fileName: string,
  extension: string
) => void

/**
 * Web default for `saveFile`: an anchor + blob browser download.
 */
export const triggerDownload: SaveFile = (content, fileName, extension) => {
  const finalFileName = fileName.endsWith(extension)
    ? fileName
    : fileName + extension

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
