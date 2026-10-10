import type { GazePlotterSession } from '$lib/session'
import {
  exportWorkspaceModal,
  metadataInfoModal,
} from '$lib/modals/definitions'
import type { SaveIndicator } from '$lib/data/export'
import type { WorkspaceCamera } from './camera.svelte'

/**
 * What a host page can trigger on a GazePlotter workspace, with whether each
 * may run right now. The component ships no top bar of its own: the host puts
 * these behind whatever buttons, menus or shortcuts it likes. Every `can*`
 * flag is reactive (read it in markup or `$derived` and it stays current).
 */
export interface WorkspaceActions {
  /** False while a load is in progress. */
  readonly canImport: boolean
  /** False while loading, or when the last load failed. */
  readonly canExport: boolean
  readonly canShowMetadata: boolean
  readonly canUndo: boolean
  readonly canRedo: boolean
  /** Edits a close or a new upload would lose (see WorkspaceFile). */
  readonly hasUnsavedWork: boolean
  /** For a marker on the host's export control; null while export is off. */
  readonly saveIndicator: SaveIndicator | null
  /** Current zoom level (0.25 to 1). */
  readonly zoom: number

  /** Pick files and load them (same pipeline as drag-and-drop). */
  openImport(): void
  /** The export dialog (workspace file, figures, data). */
  openExport(): void
  /** Writes the workspace file (the first time, asks where). Where the
   *  browser can only download, opens the export dialog instead. */
  save(): void
  /** Like save, always asking for a new file. */
  saveAs(): void
  /** Source, parsing and dataset details. */
  openMetadata(): void
  undo(): void
  redo(): void
  zoomIn(): void
  zoomOut(): void
  /** Back to full scale (1:1), around the middle of the view. */
  resetZoom(): void
  /** Zoom and pan so every plot is in view. */
  zoomToFit(): void
}

export function createWorkspaceActions(
  session: GazePlotterSession,
  camera: WorkspaceCamera
): WorkspaceActions {
  const { ingest, modalState, errorService, workspace, workspaceFile } = session
  const idle = () => !ingest.isLoading

  return {
    get canImport() {
      return idle()
    },
    get canExport() {
      return idle() && errorService.fatalLoad === null
    },
    get canShowMetadata() {
      return idle()
    },
    get canUndo() {
      return idle() && workspace.canUndo
    },
    get canRedo() {
      return idle() && workspace.canRedo
    },
    get hasUnsavedWork() {
      return workspaceFile.hasUnsavedWork
    },
    get saveIndicator() {
      return this.canExport ? workspaceFile.indicator : null
    },
    get zoom() {
      return camera.zoom
    },

    openImport() {
      if (idle()) void ingest.openAndLoadFiles()
    },
    openExport() {
      if (this.canExport) modalState.open(exportWorkspaceModal, {})
    },
    save() {
      if (!this.canExport) return
      if (workspaceFile.canChooseFile) void workspaceFile.save()
      else this.openExport()
    },
    saveAs() {
      if (!this.canExport) return
      if (workspaceFile.canChooseFile) void workspaceFile.saveAs()
      else this.openExport()
    },
    openMetadata() {
      if (idle()) modalState.open(metadataInfoModal, {})
    },
    undo() {
      if (idle()) workspace.undo()
    },
    redo() {
      if (idle()) workspace.redo()
    },
    zoomIn: () => camera.in(),
    zoomOut: () => camera.out(),
    resetZoom: () => camera.reset(),
    zoomToFit: () => camera.fit(),
  }
}
