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

/** A file the user chose to save the workspace into; written many times. */
export type SaveTarget = {
  readonly name: string
  /** Replaces the file's contents (atomically where the platform can). */
  write(content: Blob): Promise<void>
  /** The file as it is now, to re-read lazily referenced bytes and detect
   *  changes made elsewhere; null where the platform cannot read it back. */
  read(): Promise<File | null>
}

/** The `pickSaveTarget` embedding option: a save-as dialog. Null = cancelled. */
export type PickSaveTarget = (
  suggestedName: string,
  extension: string
) => Promise<SaveTarget | null>

type FileHandle = {
  name: string
  getFile(): Promise<File>
  createWritable(): Promise<{
    write(data: Blob): Promise<void>
    close(): Promise<void>
    abort(): Promise<void>
  }>
}
type ShowSaveFilePicker = (options: {
  suggestedName: string
  types: { description: string; accept: Record<string, string[]> }[]
}) => Promise<FileHandle>

/**
 * Web default for `pickSaveTarget` where the browser can write to a chosen
 * file (File System Access API, Chromium); null elsewhere (download only).
 */
export function browserPickSaveTarget(): PickSaveTarget | null {
  const picker =
    typeof window === 'undefined'
      ? undefined
      : (window as unknown as { showSaveFilePicker?: ShowSaveFilePicker })
          .showSaveFilePicker
  if (!picker) return null
  return async (suggestedName, extension) => {
    let handle: FileHandle
    try {
      handle = await picker.call(window, {
        suggestedName: suggestedName + extension,
        types: [
          {
            description: 'GazePlotter workspace',
            accept: { 'application/x-gazeplotter': [extension] },
          },
        ],
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return null
      throw error
    }
    return {
      name: handle.name,
      async write(content) {
        // Writes go to a swap file that replaces the original on close.
        const writable = await handle.createWritable()
        try {
          await writable.write(content)
        } catch (error) {
          await writable.abort()
          throw error
        }
        await writable.close()
      },
      read: () => handle.getFile(),
    }
  }
}

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
