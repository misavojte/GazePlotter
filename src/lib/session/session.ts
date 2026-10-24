import { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { readMediaEntries } from '$lib/data/media/mediaEntries'
import { readBlobZip } from '$lib/data/zip/blobZip'
import { ErrorService } from '$lib/errors'
import { browserPickSaveTarget, triggerDownload, type PickSaveTarget, type SaveFile } from './download'
import { ExportService } from './exportService.svelte'
import { IngestService } from './ingestService.svelte'
import { openFilesViaBrowser, type OpenFiles } from './openFiles'
import { WorkspaceFile } from './workspaceFile.svelte'
import { ModalState } from '$lib/modals/modalState.svelte'
import { ToastState } from '$lib/toaster/toastState.svelte'
import { GridState } from '$lib/workspace/grid/gridState.svelte'
import { WorkspaceCommandBus } from '$lib/workspace/commands/bus'
import type { GridItemSnapshot } from '$lib/workspace/grid/types'
import type { GazePlotterColors } from '$lib/DesignTokens.svelte'

export type { SaveFile, PickSaveTarget, OpenFiles, GazePlotterColors }

/** The host embedding contract: one optional field per host need, every
 *  default preserves the web behavior. See PLANDESKTOP.md. */
export type GazePlotterOptions = {
  /** Layout for gaze datasets that carry none. Default: chosen by the data. */
  defaultLayout?: GridItemSnapshot[]
  /** Delivers one export file. Default: anchor + blob browser download. */
  saveFile?: SaveFile
  /** Save-as dialog for the workspace file (Save, Save as).
   *  Default: the browser's file picker where it can write files; elsewhere
   *  (and with null) workspaces are downloaded through `saveFile`. */
  pickSaveTarget?: PickSaveTarget | null
  /** What the upload affordances open. Default: browser file picker. */
  openFiles?: OpenFiles
  /** Palette overrides; applied reactively, unlike the other fields. */
  colors?: GazePlotterColors
}

export type GazePlotterSession = {
  engine: DataEngine
  errorService: ErrorService
  exportService: ExportService
  workspaceFile: WorkspaceFile
  ingest: IngestService
  grid: GridState
  workspace: WorkspaceCommandBus
  modalState: ModalState
  toastState: ToastState
}

export function createGazePlotterSession(
  options: GazePlotterOptions = {}
): GazePlotterSession {
  const engine = new DataEngine()
  const grid = new GridState()
  const modalState = new ModalState()
  const toastState = new ToastState()
  const errorService = new ErrorService(toastState)
  const workspace = new WorkspaceCommandBus({
    engine,
    errorService,
    grid,
    toastState,
  })
  const ingest: IngestService = new IngestService({
    errorService,
    engine,
    grid,
    modalState,
    toastState,
    resetWorkspaceHistory: () => {
      workspace.clearHistory()
      workspaceFile.reset()
    },
    applyCommand: command => workspace.apply(command),
    defaultLayout: options.defaultLayout,
    openFiles: options.openFiles ?? openFilesViaBrowser,
    confirmReplace: (): boolean =>
      !workspaceFile.hasUnsavedWork ||
      window.confirm('You have unsaved changes. Discard them and open the new files?'),
  })
  const saveFile = options.saveFile ?? triggerDownload
  const exportService = new ExportService({
    errorService,
    engine,
    grid,
    ingest,
    toastState,
    saveFile,
  })
  const workspaceFile: WorkspaceFile = new WorkspaceFile({
    build: () => exportService.buildWorkspaceFile(),
    history: workspace.history,
    ingest,
    // Media reads lazily from the file it came from; after a save, from the new one.
    rebindMedia: async written => {
      const entries = (await readBlobZip(written)).values()
      const media = engine.metadata?.stimuliMedia ?? {}
      const blobs = await readMediaEntries(written, entries, media)
      for (const [id, blob] of Object.entries(blobs)) {
        engine.media.rebindBlob(Number(id), blob, media[Number(id)].kind)
      }
    },
    pickSaveTarget:
      options.pickSaveTarget === undefined ? browserPickSaveTarget() : options.pickSaveTarget,
    saveFile,
    confirmOverwrite: name =>
      window.confirm(`${name} was changed since your last save (another tab or app). Overwrite it?`),
    errorService,
    toastState,
  })

  return {
    engine,
    errorService,
    exportService,
    workspaceFile,
    ingest,
    grid,
    workspace,
    modalState,
    toastState,
  }
}

