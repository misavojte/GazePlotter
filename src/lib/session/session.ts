import { getContext, hasContext, setContext } from 'svelte'
import { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import { FileState } from '$lib/file.state.svelte'
import { ModalState } from '$lib/modals/modal.state.svelte'
import { ToastState } from '$lib/toaster/toastState.svelte'
import { GridState } from '$lib/workspace/grid/store.svelte'

const GAZEPLOTTER_SESSION_CONTEXT = Symbol('gazeplotter-session')

export type GazePlotterSession = {
  engine: DataEngine
  fileState: FileState
  grid: GridState
  modalState: ModalState
  toastState: ToastState
}

export function createGazePlotterSession(): GazePlotterSession {
  return {
    engine: new DataEngine(),
    fileState: new FileState(),
    grid: new GridState(),
    modalState: new ModalState(),
    toastState: new ToastState(),
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

export function getFileState(): FileState {
  return getGazePlotterSession().fileState
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
