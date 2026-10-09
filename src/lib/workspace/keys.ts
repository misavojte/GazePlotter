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
  | 'zoom-fit'

/** The shortcut this event is (a Ctrl/Cmd chord, or Shift+1), or null. */
export function resolveWorkspaceShortcut(
  event: KeyboardEvent
): WorkspaceShortcut | null {
  // Shift+1 zooms to fit, as in Figma and Miro: the one bare-key shortcut.
  if (
    event.shiftKey &&
    event.code === 'Digit1' &&
    !(event.ctrlKey || event.metaKey || event.altKey)
  ) {
    return 'zoom-fit'
  }
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

const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.userAgent)

/** The platform's chord modifier, as its users see it written. */
export const MODIFIER_LABEL = IS_MAC ? '⌘' : 'Ctrl'

const SHORTCUT_LABELS: Record<WorkspaceShortcut, [mac: string, other: string]> = {
  undo: ['⌘Z', 'Ctrl+Z'],
  redo: ['⇧⌘Z', 'Ctrl+Y'],
  'zoom-in': ['⌘+', 'Ctrl+Plus'],
  'zoom-out': ['⌘-', 'Ctrl+Minus'],
  'zoom-reset': ['⌘0', 'Ctrl+0'],
  'zoom-fit': ['⇧1', 'Shift+1'],
}

/** A control label with its shortcut, in one notation per platform. */
export function withShortcut(label: string, shortcut: WorkspaceShortcut): string {
  return `${label} (${SHORTCUT_LABELS[shortcut][IS_MAC ? 0 : 1]})`
}
