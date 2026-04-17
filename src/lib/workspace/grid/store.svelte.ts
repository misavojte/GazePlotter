// src/lib/workspace/grid/store.svelte.ts
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

  // Ephemeral: which grid item the right-side Pane is currently configuring.
  // Not persisted to workspace JSON; lives only in runtime state.
  selectedItemId = $state<number | null>(null)

  // --- Derived Calculations (Runes) ---
  positions = $derived(this.createPositionsSnapshot())

  isEmpty = $derived(this.items.length === 0)

  selectedItem = $derived(
    this.selectedItemId === null
      ? null
      : (this.items.find(i => i.id === this.selectedItemId) ?? null)
  )

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
    if (this.selectedItemId === id) this.selectedItemId = null
  }

  setSelectedItem(id: number | null) {
    if (id === null) {
      this.selectedItemId = null
      return
    }
    if (this.items.some(i => i.id === id)) this.selectedItemId = id
  }

  toggleSelectedItem(id: number) {
    this.setSelectedItem(this.selectedItemId === id ? null : id)
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
    this.selectedItemId = null
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
  resolveItemPositionCollisions(priorityItemId: number): Array<{
    itemId: number
    settings: GridItemLayoutUpdate
  }> {
    return GridEngine.resolveItemPositionCollisions(
      priorityItemId,
      this.createPositionsSnapshot(),
      this.items,
      this.getAvailableColumns()
    )
  }
}
