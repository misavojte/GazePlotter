// src/lib/workspace/grid/store.svelte.ts
import type { GridItemMap, AllGridTypes } from '$lib/workspace/type/gridType'
import { getVizConfig } from '$lib/plots/registry'
import {
  DEFAULT_GRID_CONFIG,
  calculateGridHeight,
  calculateGridWidth,
  calculateRequiredWorkspaceHeight,
} from '$lib/workspace/grid'
import { generateUniqueId } from '$lib/shared/utils/idUtils'
import type { GridConfig, GridItemPosition } from './types'
import { DEFAULT_GRID_STATE_DATA } from './const'
import * as GridEngine from './engine'

export class GridState {
  // --- Core Reactive State ---
  items = $state<AllGridTypes[]>([])
  config = $state<GridConfig>(DEFAULT_GRID_CONFIG)

  // UI Sync State (Previously scattered local stores)
  temporaryDragHeight = $state<number | null>(null)
  temporaryDragWidth = $state<number | null>(null)
  isLoading = $state(false)

  // --- Derived Calculations (Runes) ---
  positions = $derived(
    this.items.map(item => ({
      id: item.id,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
    }))
  )

  isEmpty = $derived(this.items.length === 0)

  requiredWorkspaceHeight = $derived(
    calculateRequiredWorkspaceHeight(this.positions, this.config)
  )

  height = $derived(
    calculateGridHeight(
      this.positions,
      this.isEmpty,
      this.isLoading,
      this.temporaryDragHeight,
      this.config
    )
  )

  width = $derived(
    calculateGridWidth(this.positions, this.temporaryDragWidth, this.config)
  )

  // --- Private Logic ---
  // (Internal geometry logic moved to engine.ts)

  private createItem<K extends keyof GridItemMap>(
    type: K,
    options: Partial<GridItemMap[K]> = {}
  ): AllGridTypes {
    const viz = getVizConfig(type)
    const id = options.id ?? generateUniqueId()

    // The registry now provides the correct default height/width based on the type key
    const base = {
      id,
      x: options.x ?? 0,
      y: options.y ?? 0,
      w: options.w ?? viz.getDefaultWidth((options as any).stimulusId),
      h: options.h ?? viz.getDefaultHeight((options as any).stimulusId),
      min: options.min ?? viz.getDefaultConfig().min,
      redrawTimestamp: Date.now(),
    }

    // Type safety is guaranteed by the generic K
    // Merge base properties with default config and options
    const merged = {
      ...base,
      type,
      ...viz.getDefaultConfig(options),
      ...options,
    }

    // Type assertion is safe because:
    // 1. `type` ensures we have the correct discriminant
    // 2. `viz.getDefaultConfig` provides all required properties for type K
    // 3. `options` can override any properties
    return merged as unknown as AllGridTypes
  }

  // --- Grid Manipulation & Collision Logic ---
  isAreaAvailable(
    x: number,
    y: number,
    w: number,
    h: number,
    excludeId: number = -1
  ): boolean {
    return GridEngine.isAreaAvailable(x, y, w, h, this.positions, excludeId)
  }

  findOptimalPosition(
    w: number,
    h: number,
    referenceItem?: GridItemPosition
  ): { x: number; y: number } {
    return GridEngine.findOptimalPosition(
      w,
      h,
      this.positions,
      this.config,
      referenceItem
    )
  }

  addItem(type: AllGridTypes['type'], options: Partial<AllGridTypes> = {}) {
    const newItem = this.createItem(type as keyof GridItemMap, options)
    const suggested = this.findOptimalPosition(newItem.w, newItem.h)

    if (
      options.x !== undefined &&
      options.y !== undefined &&
      this.isAreaAvailable(options.x, options.y, newItem.w, newItem.h)
    ) {
      newItem.x = options.x
      newItem.y = options.y
    } else {
      newItem.x = suggested.x
      newItem.y = suggested.y
    }

    this.items.push(newItem)
    return newItem.id
  }

  removeItem(id: number) {
    this.items = this.items.filter(i => i.id !== id)
  }

  updateSettings(id: number, settings: Partial<AllGridTypes>) {
    const index = this.items.findIndex(i => i.id === id)
    if (index !== -1) {
      this.items[index] = { ...this.items[index], ...settings } as AllGridTypes
    }
  }

  reset(
    layout: Array<
      Partial<AllGridTypes> & { type: AllGridTypes['type'] }
    > = DEFAULT_GRID_STATE_DATA
  ) {
    // Build all items locally first to avoid intermediate reactive updates.
    // Previously, `this.items = []` followed by N `push()` calls caused N+1
    // reactive updates with partial/empty arrays, crashing downstream components
    // in production builds where Svelte processes intermediate states eagerly.
    const newItems: AllGridTypes[] = []
    for (const itemDef of layout) {
      const newItem = this.createItem(
        itemDef.type as keyof GridItemMap,
        itemDef
      )
      // Use provided positions if available and valid
      const tempPositions = newItems.map(i => ({
        id: i.id,
        x: i.x,
        y: i.y,
        w: i.w,
        h: i.h,
      }))
      if (
        itemDef.x !== undefined &&
        itemDef.y !== undefined &&
        GridEngine.isAreaAvailable(
          itemDef.x,
          itemDef.y,
          newItem.w,
          newItem.h,
          tempPositions
        )
      ) {
        newItem.x = itemDef.x
        newItem.y = itemDef.y
      } else {
        const pos = GridEngine.findOptimalPosition(
          newItem.w,
          newItem.h,
          tempPositions,
          this.config
        )
        newItem.x = pos.x
        newItem.y = pos.y
      }
      newItems.push(newItem)
    }
    // Single atomic assignment — one reactive update instead of N+1
    this.items = newItems
  }

  triggerRedraw(id?: number) {
    this.items.forEach(item => {
      if (id === undefined || item.id === id) {
        item.redrawTimestamp++
      }
    })
  }

  updateItem(id: number, settings: Partial<AllGridTypes>) {
    this.updateSettings(id, settings)
  }

  duplicateItem(item: AllGridTypes, duplicateId?: number) {
    const duplicate = { ...item, id: duplicateId ?? generateUniqueId() }
    const newPosition = this.findOptimalPosition(item.w, item.h, item)
    duplicate.x = newPosition.x
    duplicate.y = newPosition.y
    this.items.push(duplicate)
    return duplicate.id
  }

  setLayoutState(
    layout: Array<Partial<AllGridTypes> & { type: AllGridTypes['type'] }>
  ) {
    // Delegate to reset() which handles batched item creation
    this.reset(layout)
  }

  /**
   * Resolves conflicts by moving colliding items to available positions with minimal movement
   */
  resolveItemPositionCollisions(priorityItemId: number): Array<{
    itemId: number
    settings: Partial<AllGridTypes>
  }> {
    return GridEngine.resolveItemPositionCollisions(
      priorityItemId,
      this.positions,
      this.items,
      this.config
    )
  }
}

export const grid = new GridState()

// Backwards-compatible initializer for code that wants to set initial layout
export function initializeGridStateStore(
  layout: Array<
    Partial<import('$lib/workspace/type/gridType').AllGridTypes> & {
      type: string
    }
  > | null = null
) {
  if (!layout) {
    grid.reset(DEFAULT_GRID_STATE_DATA)
  } else {
    grid.reset(layout)
  }
}
