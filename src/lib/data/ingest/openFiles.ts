/** Signature of the `openFiles` embedding option: what the workspace upload
 *  affordances open. Resolving `[]` means the user cancelled. */
export type OpenFiles = () => Promise<File[]>

/** Extensions ingest can classify; mirrors the format routing. Images/videos
 *  are stimulus reference media, matched to stimuli by file name post-load. */
export const INGEST_FILE_ACCEPT = '.csv,.txt,.tsv,.json,.zip,.xml,image/*,video/*'

/** Web default for `openFiles`: a one-shot browser file picker. */
export const openFilesViaBrowser: OpenFiles = () =>
  new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = INGEST_FILE_ACCEPT
    input.onchange = () => resolve(Array.from(input.files ?? []))
    input.oncancel = () => resolve([])
    input.click()
  })
