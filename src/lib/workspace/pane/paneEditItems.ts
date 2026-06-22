import { getContext, setContext } from 'svelte'
import type { PaneSectionItem } from '$lib/plots/definePlot'

/**
 * Pane edit scope.
 *
 * A pane section edits a SET of grid items. Normally that set is just the
 * section's own item (single selection). When the workspace renders a pane for
 * a MULTI-selection (bulk edit), it provides the full selection here; each
 * section then reads the live set for both display (common value / "Mixed")
 * and writes (apply the same change to every selected item, atomically).
 *
 * This is the "single is cardinality-1" principle: a section never branches on
 * single vs bulk — it always edits a set, which defaults to one.
 */
const PANE_EDIT_ITEMS = Symbol('pane-edit-items')

/** Provider: a live getter for the items pane edits apply to (bulk mode). */
export function setPaneEditItems(getItems: () => PaneSectionItem[]): void {
  setContext(PANE_EDIT_ITEMS, getItems)
}

/**
 * Consumer: returns the live items getter when inside a multi-selection pane,
 * else undefined (single pane → the section edits just its own item).
 */
export function getPaneEditItems(): (() => PaneSectionItem[]) | undefined {
  return getContext(PANE_EDIT_ITEMS) as (() => PaneSectionItem[]) | undefined
}
