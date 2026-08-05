/**
 * Workspace keyboard: which key means what, and whether a key belongs to the
 * workspace at all. Reading the event is pure and lives here; whether a
 * shortcut may RUN is policy, and stays with the state it acts on.
 */

/** True when the key belongs to a text field rather than to a shortcut. */
export function isTextEntryTarget(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null
  if (!target) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    // `=== true`: a keydown target can be a Document, which has no such flag.
    target.isContentEditable === true
  )
}

export type WorkspaceShortcut =
  | 'undo'
  | 'redo'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-reset'

/** The Ctrl/Cmd chord this event is, or null when it is not one of ours. */
export function resolveWorkspaceShortcut(
  event: KeyboardEvent
): WorkspaceShortcut | null {
  if (!(event.ctrlKey || event.metaKey)) return null
  // `code` for the letters so the chord survives a non-QWERTY layout; `key` for
  // the zoom glyphs, where +/= share one physical key.
  if (event.code === 'KeyZ') return event.shiftKey ? 'redo' : 'undo'
  if (event.code === 'KeyY' && !event.shiftKey) return 'redo'
  if (event.key === '+' || event.key === '=') return 'zoom-in'
  if (event.key === '-') return 'zoom-out'
  if (event.key === '0') return 'zoom-reset'
  return null
}
