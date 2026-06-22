import { getContext, hasContext, setContext } from 'svelte'
import { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { ExportService } from '$lib/data/export'
import { ErrorService } from '$lib/errors'
import { IngestService } from '$lib/data/ingest'
import { ModalState } from '$lib/modals/modalState.svelte'
import { ToastState } from '$lib/toaster/toastState.svelte'
import { GridState } from '$lib/workspace/grid/gridState.svelte'
import { WorkspaceService } from '$lib/workspace/service.svelte'

const GAZEPLOTTER_SESSION_CONTEXT = Symbol.for('gazeplotter-session')

export type GazePlotterSession = {
  engine: DataEngine
  errorService: ErrorService
  exportService: ExportService
  ingest: IngestService
  grid: GridState
  workspace: WorkspaceService
  modalState: ModalState
  toastState: ToastState
}

export function createGazePlotterSession(): GazePlotterSession {
  const engine = new DataEngine()
  const grid = new GridState()
  const modalState = new ModalState()
  const toastState = new ToastState()
  const errorService = new ErrorService(toastState)
  const workspace = new WorkspaceService({
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
    }),
    ingest,
    grid,
    workspace,
    modalState,
    toastState,
  }
}

export function setGazePlotterSessionContext(
  session: GazePlotterSession
): GazePlotterSession {
  setContext(GAZEPLOTTER_SESSION_CONTEXT, session)
  return session
}

export function getGazePlotterSession(): GazePlotterSession {
  try {
    if (hasContext(GAZEPLOTTER_SESSION_CONTEXT)) {
      return getContext<GazePlotterSession>(GAZEPLOTTER_SESSION_CONTEXT)
    }
  } catch {
    // Context access is only available during component initialization.
  }

  throw new Error(
    'GazePlotter session is not available. Access it from within a GazePlotter tree or pass dependencies explicitly.'
  )
}

