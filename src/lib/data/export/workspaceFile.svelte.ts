import type { ErrorService } from '$lib/errors'
import type { ToastState } from '$lib/toaster/toastState.svelte'
import type { PickSaveTarget, SaveFile, SaveTarget } from './download'
import { WORKSPACE_EXTENSION } from './controller'

export type SaveIndicator = 'unsaved' | 'saved' | 'new'

type WorkspaceFileDeps = {
  /** The whole workspace as one `.gazeplotter` file. */
  build: () => Promise<Blob>
  history: {
    readonly head: number | null
    readonly isDirty: boolean
    markSaved(head: number | null): void
  }
  ingest: {
    readonly isLoading: boolean
    readonly isUserDataset: boolean
    readonly input: { fileNames: string[] } | null
  }
  /** Repoints lazily read media at the file a save just wrote. */
  rebindMedia: (written: File) => Promise<void>
  /** Null: this platform cannot write to a chosen file (downloads only). */
  pickSaveTarget: PickSaveTarget | null
  saveFile: SaveFile
  /** Asked before overwriting a file that changed since our last save. */
  confirmOverwrite: (fileName: string) => boolean
  errorService: Pick<ErrorService, 'report'>
  toastState: Pick<ToastState, 'addSuccess'>
}

/** The workspace's file: which file Save writes, and whether it is saved.
 *  Nothing about the study is kept in the browser. */
export class WorkspaceFile {
  /** The file Save writes; chosen by the user in this session only. */
  target = $state.raw<SaveTarget | null>(null)
  saving = $state(false)
  /** Last successful save or download of this workspace. */
  savedAt = $state<Date | null>(null)

  private generation = 0
  private writtenModified: number | null = null

  constructor(private readonly deps: WorkspaceFileDeps) {}

  /** False where the browser can only download copies. */
  get canChooseFile(): boolean {
    return this.deps.pickSaveTarget !== null
  }

  /** Edits worth guarding: to data the user brought, or to a saved workspace
   *  (the host's own data, like a demo, counts once it was saved). */
  get hasUnsavedWork(): boolean {
    return (
      this.deps.history.isDirty &&
      (this.deps.ingest.isUserDataset || this.savedAt !== null)
    )
  }

  /** The Export icon's dot: unsaved work, everything saved, or not in a file yet. */
  get indicator(): SaveIndicator {
    if (this.hasUnsavedWork) return 'unsaved'
    return this.savedAt !== null ? 'saved' : 'new'
  }

  /** File name without extension for pickers and downloads. */
  get suggestedName(): string {
    const source = this.target?.name ?? this.deps.ingest.input?.fileNames[0]
    const stem = source?.replace(/(\.gazeplotter)?(\.[a-z0-9]+)?$/i, '')
    return stem || 'GazePlotter'
  }

  /** A new workspace was loaded: it belongs to no file yet. */
  reset(): void {
    this.generation++
    this.target = null
    this.savedAt = null
    this.writtenModified = null
  }

  /** Writes the chosen file; the first time, asks for one. */
  save(): Promise<boolean> {
    return this.saveTo(this.target === null)
  }

  saveAs(): Promise<boolean> {
    return this.saveTo(true)
  }

  /** Downloads a copy (platforms without a writable file). */
  async download(fileName: string): Promise<boolean> {
    if (this.saving) return false
    const name = fileName.trim() || this.suggestedName
    const head = this.deps.history.head
    this.saving = true
    try {
      // Octet-stream: Safari renames or unpacks zip-typed downloads.
      const content = new Blob([await this.deps.build()], { type: 'application/octet-stream' })
      this.deps.saveFile(content, name + WORKSPACE_EXTENSION, WORKSPACE_EXTENSION)
      this.deps.history.markSaved(head)
      this.savedAt = new Date()
      this.deps.toastState.addSuccess(`Downloaded ${name}${WORKSPACE_EXTENSION}`)
      return true
    } catch (error) {
      this.report(error)
      return false
    } finally {
      this.saving = false
    }
  }

  private async saveTo(choose: boolean): Promise<boolean> {
    if (this.saving || this.deps.ingest.isLoading) return false
    let target = this.target
    if (choose || !target) {
      if (!this.deps.pickSaveTarget) return false
      try {
        // First await: the picker needs the click's user activation.
        target = await this.deps.pickSaveTarget(this.suggestedName, WORKSPACE_EXTENSION)
      } catch (error) {
        this.report(error)
        return false
      }
      if (!target) return false
    }
    const known = target === this.target
    const generation = this.generation
    const head = this.deps.history.head
    this.saving = true
    try {
      if (known && this.writtenModified !== null) {
        const current = await target.read()
        if (
          current &&
          current.lastModified !== this.writtenModified &&
          !this.deps.confirmOverwrite(target.name)
        ) {
          return false
        }
      }
      await target.write(await this.deps.build())
      // A new workspace loaded meanwhile: the file holds the old one.
      if (generation !== this.generation) return false
      const written = await target.read()
      this.writtenModified = written?.lastModified ?? null
      if (written) await this.deps.rebindMedia(written)
      this.target = target
      this.deps.history.markSaved(head)
      this.savedAt = new Date()
      this.deps.toastState.addSuccess(`Saved ${target.name}`)
      return true
    } catch (error) {
      if (known && error instanceof DOMException && error.name === 'NotAllowedError') {
        this.target = null // permission revoked: the next Save asks again
      }
      this.report(error)
      return false
    } finally {
      this.saving = false
    }
  }

  private report(error: unknown): void {
    const detail = error instanceof Error ? error.message : 'unexpected error'
    this.deps.errorService.report({
      origin: 'export',
      severity: 'recoverable',
      userMessage: `Could not save: ${detail}`,
      cause: error,
      context: { exportType: 'workspace' },
    })
  }
}
