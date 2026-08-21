import { getContext, hasContext, setContext } from 'svelte'
import type { GazePlotterSession } from './session'

// Deliberately light: leaf state modules import this, never ./session's graph.

const GAZEPLOTTER_SESSION_CONTEXT = Symbol.for('gazeplotter-session')

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

/** One instance per session: `const useX = sessionScoped(() => new X())`,
 *  resolved at component init. Module-level `$state` is pinned away.
 *  State that services are constructed with stays a session field. */
export function sessionScoped<T>(create: () => T): () => T {
  const bySession = new WeakMap<GazePlotterSession, T>()
  return () => {
    const session = getGazePlotterSession()
    let value = bySession.get(session)
    if (value === undefined) {
      value = create()
      bySession.set(session, value)
    }
    return value
  }
}
