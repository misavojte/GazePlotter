import { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { ExportService, triggerDownload, type SaveFile } from '$lib/data/export'
import { ErrorService } from '$lib/errors'
import {
  IngestService,
  openFilesViaBrowser,
  type OpenFiles,
} from '$lib/data/ingest'
import { ModalState } from '$lib/modals/modalState.svelte'
import { ToastState } from '$lib/toaster/toastState.svelte'
import { GridState } from '$lib/workspace/grid/gridState.svelte'
import { WorkspaceCommandBus } from '$lib/workspace/commands/bus'
import { DEFAULT_GRID_STATE_DATA } from '$lib/workspace/grid/const'
import type { GridItemSnapshot } from '$lib/workspace/grid/types'
import type { GazePlotterColors } from '$lib/DesignTokens.svelte'

export type { SaveFile, OpenFiles, GazePlotterColors }

/** The host embedding contract: one optional field per host need, every
 *  default preserves the web behavior. See PLANDESKTOP.md. */
export type GazePlotterOptions = {
  /** Layout for datasets that carry none (fresh parses, empty workspace). */
  defaultLayout?: GridItemSnapshot[]
  /** Delivers one export file. Default: anchor + blob browser download. */
  saveFile?: SaveFile
  /** What the upload affordances open. Default: browser file picker. */
  openFiles?: OpenFiles
  /** Palette overrides; applied reactively, unlike the other fields. */
  colors?: GazePlotterColors
}

export type GazePlotterSession = {
  engine: DataEngine
  errorService: ErrorService
  exportService: ExportService
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
  const ingest = new IngestService({
    errorService,
    engine,
    grid,
    modalState,
    toastState,
    resetWorkspaceHistory: () => workspace.clearHistory(),
    defaultLayout: options.defaultLayout ?? DEFAULT_GRID_STATE_DATA,
    openFiles: options.openFiles ?? openFilesViaBrowser,
  })

  return {
    engine,
    errorService,
    exportService: new ExportService({
      errorService,
      engine,
      grid,
      ingest,
      toastState,
      saveFile: options.saveFile ?? triggerDownload,
    }),
    ingest,
    grid,
    workspace,
    modalState,
    toastState,
  }
}

