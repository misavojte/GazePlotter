import { getContext, hasContext, setContext } from 'svelte'
import { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import { IngestService } from '$lib/data/ingest'
import { ModalState } from '$lib/modals/modal.state.svelte'
import { ToastState } from '$lib/toaster/toastState.svelte'
import { GridState } from '$lib/workspace/grid/store.svelte'
import { clear } from '$lib/workspace/commands'

const GAZEPLOTTER_SESSION_CONTEXT = Symbol('gazeplotter-session')

export type GazePlotterSession = {
  engine: DataEngine
  ingest: IngestService
  grid: GridState
  modalState: ModalState
  toastState: ToastState
}

export function createGazePlotterSession(): GazePlotterSession {
  const engine = new DataEngine()
  const grid = new GridState()
  const modalState = new ModalState()
  const toastState = new ToastState()

  return {
    engine,
    ingest: new IngestService({
      engine,
      grid,
      modalState,
      toastState,
      resetWorkspaceHistory: clear,
    }),
    grid,
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

export function getIngestService(): IngestService {
  return getGazePlotterSession().ingest
}

export function getGridState(): GridState {
  return getGazePlotterSession().grid
}

export function getModalState(): ModalState {
  return getGazePlotterSession().modalState
}

export function getToastState(): ToastState {
  return getGazePlotterSession().toastState
}
