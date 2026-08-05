/**
 * The workspace's file drop target: the four drag handlers and the "is a file
 * being dragged over me" state they maintain together. Methods are arrow
 * properties so they can be wired straight to the element's handlers.
 */

const carriesFiles = (event: DragEvent): boolean =>
  event.dataTransfer?.types.includes('Files') ?? false

export class FileDropTarget {
  // A depth, not a boolean: dragenter/dragleave fire once per element crossed,
  // so a pointer moving between plots would otherwise read as having left.
  #depth = $state(0)

  get isActive(): boolean {
    return this.#depth > 0
  }

  enter = (event: DragEvent): void => {
    if (!carriesFiles(event)) return
    event.preventDefault()
    this.#depth++
  }

  over = (event: DragEvent): void => {
    const transfer = event.dataTransfer
    if (!transfer?.types.includes('Files')) return
    event.preventDefault()
    // Always a copy. `IngestService` owns "one upload at a time" and explains a
    // refusal with a toast; 'none' here would suppress the drop event itself,
    // so the refusal would lose its explanation.
    transfer.dropEffect = 'copy'
  }

  leave = (event: DragEvent): void => {
    // Same guard as `enter`: a non-file drag never increments, so it must never
    // decrement — the depth went negative and swallowed the next real drag.
    if (!carriesFiles(event)) return
    this.#depth--
  }

  /** The dropped files, or null when the drop carries none. */
  drop = (event: DragEvent): FileList | null => {
    this.#depth = 0
    const files = event.dataTransfer?.files
    if (!files?.length) return null
    event.preventDefault()
    return files
  }
}
