import { getContext, setContext } from 'svelte'

/**
 * Marker context set by Pane / PaneSheet so their descendants can opt into
 * compact form-control styling automatically. Components read this via
 * `isInPane()` — when true, a component should behave as if `compact` /
 * `appearance="compact"` was passed explicitly.
 *
 * This replaces the previous `.body :global(.trigger) { ... }` reach-ins that
 * fought with each component's own CSS. Each component owns its own compact
 * variant; the pane only signals that the variant should be active.
 */
const KEY = Symbol('gazeplotter.pane.inPane')

export function markInPane(): void {
  setContext(KEY, true)
}

export function isInPane(): boolean {
  return getContext(KEY) === true
}
