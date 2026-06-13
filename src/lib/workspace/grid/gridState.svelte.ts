// src/lib/workspace/grid/gridState.svelte.ts
import type {
  GridItemMap,
  AllGridTypes,
  GridItemLayoutUpdate,
  GridItemSnapshot,
  PlotSettingsMap,
} from '$lib/workspace'
import { DEFAULT_GRID_CONFIG } from './const'
import type { GridConfig, GridItemPosition } from './types'
import { DEFAULT_GRID_STATE_DATA } from './const'
import * as GridEngine from './engine'
import { createGridItem, duplicateGridItem } from './itemFactory'
import { calculateViewportGridColumns } from './sizing'

type GridStateOptions = {
  getAvailableColumns?: (config: GridConfig) => number
}

export class GridState {
  private readonly getAvailableColumnsFn: (config: GridConfig) => number

  // --- Core Reactive State ---
  items = $state<AllGridTypes[]>([])
  config = $state<GridConfig>(DEFAULT_GRID_CONFIG)

  // UI sync state that needs to survive outside local components.
  isLoading = $state(false)

  // Ephemeral selection set: which grid items are currently selected.
  // A single selection is just a set of size 1; a multi-selection is a set
  // of N. Not persisted to workspace JSON; lives only in runtime state.
  selectedItemIds = $state<number[]>([])

  // Ephemeral: which grid item currently has its settings pane/sheet open.
  // On desktop this mirrors `selectedItemId` — click a plot, pane opens.
  // On mobile, selection and pane-open decouple: tapping a plot only
  // selects (enabling drag); the floating Edit FAB drives pane open.
  // Orchestration happens at the click site, not here.
  paneOpenId = $state<number | null>(null)

  // --- Derived Calculations (Runes) ---
  positions = $derived(this.createPositionsSnapshot())

  isEmpty = $derived(this.items.length === 0)

  // Selection projections are plain getters over the `selectedItemIds`
  // $state: trivial, always-fresh, and reactive inside components (the
  // $state read during the getter call is tracked by the caller). Using
  // getters rather than $derived avoids memoization that can go stale when
  // read outside a tracking scope (e.g. unit tests).
  get selectedCount(): number {
    return this.selectedItemIds.length
  }

  // The single-selection id: the one selected item, or null when zero OR
  // more than one are selected. This is the single place the "exactly one"
  // notion is expressed — single-only consumers (mobile FAB, off-screen
  // indicator, Delete/Escape, the per-plot Pane) read this and behave
  // exactly as before whenever 0 or 1 items are selected.
  get selectedItemId(): number | null {
    return this.selectedItemIds.length === 1 ? this.selectedItemIds[0] : null
  }

  get selectedItem(): AllGridTypes | null {
    const id = this.selectedItemId
    return id === null ? null : (this.items.find(i => i.id === id) ?? null)
  }

  get selectedItems(): AllGridTypes[] {
    return this.selectedItemIds
      .map(id => this.items.find(i => i.id === id))
      .filter((i): i is AllGridTypes => i != null)
  }

  constructor(options: GridStateOptions = {}) {
    this.getAvailableColumnsFn =
      options.getAvailableColumns ?? calculateViewportGridColumns
  }

  private getAvailableColumns(): number {
    return this.getAvailableColumnsFn(this.config)
  }

  private createPositionsSnapshot(
    items: Pick<AllGridTypes, 'id' | 'x' | 'y' | 'w' | 'h'>[] = this.items
  ): GridItemPosition[] {
    return items.map(item => ({
      id: item.id,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
    }))
  }

  private resolvePlacement(
    item: Pick<AllGridTypes, 'w' | 'h'>,
    positions: GridItemPosition[],
    requested?: Partial<Pick<GridItemPosition, 'x' | 'y'>>,
    referenceItem?: GridItemPosition
  ): { x: number; y: number } {
    if (
      requested?.x !== undefined &&
      requested?.y !== undefined &&
      GridEngine.isAreaAvailable(
        requested.x,
        requested.y,
        item.w,
        item.h,
        positions
      )
    ) {
      return {
        x: requested.x,
        y: requested.y,
      }
    }

    return GridEngine.findOptimalPosition(
      item.w,
      item.h,
      positions,
      this.getAvailableColumns(),
      referenceItem
    )
  }

  // --- Grid Manipulation & Collision Logic ---
  isAreaAvailable(
    x: number,
    y: number,
    w: number,
    h: number,
    excludeId: number = -1
  ): boolean {
    return GridEngine.isAreaAvailable(
      x,
      y,
      w,
      h,
      this.createPositionsSnapshot(),
      excludeId
    )
  }

  findOptimalPosition(
    w: number,
    h: number,
    referenceItem?: GridItemPosition
  ): { x: number; y: number } {
    return GridEngine.findOptimalPosition(
      w,
      h,
      this.createPositionsSnapshot(),
      this.getAvailableColumns(),
      referenceItem
    )
  }

  addItem<K extends keyof GridItemMap>(
    type: K,
    options: GridItemSnapshot<K> = { type },
    requestedPosition?: { x: number; y: number }
  ) {
    const newItem = createGridItem(type, options)
    if (requestedPosition) {
      // Explicit position from a placement-mode commit: honor directly
      // and let `emitCollisionResolutionChildren` push overlapping
      // items aside (same downstream behavior as a move commit).
      newItem.x = Math.max(0, requestedPosition.x)
      newItem.y = Math.max(0, requestedPosition.y)
    } else {
      const placement = this.resolvePlacement(
        newItem,
        this.createPositionsSnapshot(),
        options
      )
      newItem.x = placement.x
      newItem.y = placement.y
    }

    this.items.push(newItem)
    return newItem.id
  }

  removeItem(id: number) {
    this.items = this.items.filter(i => i.id !== id)
    this.selectedItemIds = this.selectedItemIds.filter(x => x !== id)
    if (this.paneOpenId === id) this.paneOpenId = null
  }

  setSelectedItem(id: number | null) {
    if (id === null) {
      this.clearSelection()
      return
    }
    // Single-select entry point: collapse the set to exactly this item.
    // Used by add/duplicate flows that then call `openPane(newId)`.
    if (this.items.some(i => i.id === id)) this.selectedItemIds = [id]
  }

  /** Replace the selection with exactly this item (plain click). */
  selectOnly(id: number) {
    if (this.items.some(i => i.id === id)) this.selectedItemIds = [id]
  }

  /** Add/remove this item from the selection (Cmd/Ctrl-click). */
  toggleInSelection(id: number) {
    if (!this.items.some(i => i.id === id)) return
    const next = this.selectedItemIds.includes(id)
      ? this.selectedItemIds.filter(x => x !== id)
      : [...this.selectedItemIds, id]
    this.selectedItemIds = next
    // Close the pane when the selection empties, and keep an ALREADY-OPEN
    // single pane in sync when collapsing from a multi-selection. Never OPEN a
    // pane that wasn't open: additive (Cmd/Ctrl/Shift) clicks build a
    // selection without triggering click-to-edit (see GridItem.onFrameClick).
    // (A selection of 2+ shows the bulk pane regardless of paneOpenId.)
    if (next.length === 0) {
      this.paneOpenId = null
    } else if (next.length === 1 && this.paneOpenId !== null) {
      this.paneOpenId = next[0]
    }
  }

  clearSelection() {
    this.selectedItemIds = []
    // Deselect always closes any open pane/sheet. A pane is always bound to
    // a selection — keeping it open without one would strand the
    // drag/duplicate/remove chrome that the selection also owns.
    this.paneOpenId = null
  }

  openPane(id: number) {
    if (this.items.some(i => i.id === id)) this.paneOpenId = id
  }

  closePane() {
    this.paneOpenId = null
  }

  updateSettings(
    id: number,
    settings: Partial<PlotSettingsMap[keyof PlotSettingsMap]>
  ) {
    const index = this.items.findIndex(i => i.id === id)
    if (index !== -1) {
      this.items[index] = {
        ...this.items[index],
        settings: {
          ...this.items[index].settings,
          ...settings,
        },
      } as AllGridTypes
    }
  }

  updateLayout(id: number, layout: GridItemLayoutUpdate) {
    const index = this.items.findIndex(i => i.id === id)
    if (index !== -1) {
      this.items[index] = {
        ...this.items[index],
        ...layout,
      } as AllGridTypes
    }
  }

  reset(layout: GridItemSnapshot[] = DEFAULT_GRID_STATE_DATA) {
    // Build all items locally first to avoid intermediate reactive updates.
    // Previously, `this.items = []` followed by N `push()` calls caused N+1
    // reactive updates with partial/empty arrays, crashing downstream components
    // in production builds where Svelte processes intermediate states eagerly.
    const newItems: AllGridTypes[] = []
    for (const itemDef of layout) {
      const newItem = createGridItem(itemDef.type, itemDef)
      // Use provided positions if available and valid
      const tempPositions = this.createPositionsSnapshot(newItems)
      const placement = this.resolvePlacement(newItem, tempPositions, itemDef)
      newItem.x = placement.x
      newItem.y = placement.y
      newItems.push(newItem)
    }
    // Single atomic assignment — one reactive update instead of N+1
    this.items = newItems
    this.selectedItemIds = []
    this.paneOpenId = null
  }

  triggerRedraw(id?: number) {
    this.items.forEach(item => {
      if (id === undefined || item.id === id) {
        item.redrawTimestamp++
      }
    })
  }

  updateItem(
    id: number,
    settings: Partial<PlotSettingsMap[keyof PlotSettingsMap]>
  ) {
    this.updateSettings(id, settings)
  }

  duplicateItem(
    item: AllGridTypes,
    duplicateId?: number,
    requestedPosition?: { x: number; y: number }
  ) {
    const duplicate = duplicateGridItem(item, duplicateId)
    if (requestedPosition) {
      // When the caller specifies a position (duplicate-to-cursor flow),
      // honor it directly. Any resulting collision is resolved by the
      // command registry via `emitCollisionResolutionChildren`, which
      // pushes overlapping items aside — same behavior as a move commit.
      duplicate.x = Math.max(0, requestedPosition.x)
      duplicate.y = Math.max(0, requestedPosition.y)
    } else {
      const placement = this.resolvePlacement(
        duplicate,
        this.createPositionsSnapshot(),
        undefined,
        item
      )
      duplicate.x = placement.x
      duplicate.y = placement.y
    }
    this.items.push(duplicate)
    return duplicate.id
  }

  setLayoutState(layout: GridItemSnapshot[]) {
    // Delegate to reset() which handles batched item creation
    this.reset(layout)
  }

  /**
   * Resolves conflicts by moving colliding items to available positions with minimal movement
   */
  resolveItemPositionCollisions(priorityItemIds: number | number[]): Array<{
    itemId: number
    settings: GridItemLayoutUpdate
  }> {
    return GridEngine.resolveItemPositionCollisions(
      priorityItemIds,
      this.createPositionsSnapshot(),
      this.items,
      this.getAvailableColumns()
    )
  }
}
