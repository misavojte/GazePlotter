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
  private rectanglesOverlap(
    x1: number,
    y1: number,
    w1: number,
    h1: number,
    x2: number,
    y2: number,
    w2: number,
    h2: number
  ): boolean {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2
  }

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
    if (x < 0 || y < 0) return false
    return !this.positions.some(
      item =>
        item.id !== excludeId &&
        this.rectanglesOverlap(x, y, w, h, item.x, item.y, item.w, item.h)
    )
  }

  /**
   * Finds all items that collide with a given area
   */
  private findCollisions(
    x: number,
    y: number,
    w: number,
    h: number,
    excludeId: number = -1
  ): Set<number> {
    const collisions = new Set<number>()
    for (const item of this.positions) {
      if (item.id === excludeId) continue
      if (this.rectanglesOverlap(x, y, w, h, item.x, item.y, item.w, item.h)) {
        collisions.add(item.id)
      }
    }
    return collisions
  }

  findOptimalPosition(
    w: number,
    h: number,
    referenceItem?: GridItemPosition
  ): { x: number; y: number } {
    if (this.isEmpty) return { x: 0, y: 0 }

    if (referenceItem) {
      const { x: oX, y: oY, w: oW, h: oH } = referenceItem
      if (this.isAreaAvailable(oX + oW, oY, w, h)) return { x: oX + oW, y: oY }
      if (this.isAreaAvailable(oX, oY + oH, w, h)) return { x: oX, y: oY + oH }
    }

    const cellWidth = this.config.cellSize.width + this.config.gap
    const availableWidth = Math.floor(window.innerWidth / cellWidth)
    const maxX = Math.max(availableWidth, ...this.positions.map(i => i.x + i.w))
    const maxY = Math.max(0, ...this.positions.map(i => i.y + i.h))

    for (let y = 0; y <= maxY; y++) {
      for (let x = 0; x <= maxX - w; x++) {
        if (this.isAreaAvailable(x, y, w, h)) return { x, y }
      }
    }
    return { x: 0, y: maxY }
  }

  /**
   * Finds the best position to resolve a conflict with minimal movement
   */
  private findBestConflictResolutionPosition(
    item: AllGridTypes,
    priorityItem: { x: number; y: number; w: number; h: number },
    excludeId: number
  ): { x: number; y: number } | null {
    const { x: itemX, y: itemY, w: itemW, h: itemH } = item
    const {
      x: priorityX,
      y: priorityY,
      w: priorityW,
      h: priorityH,
    } = priorityItem

    // Calculate movement distances for each direction
    const potentialPositions = [
      {
        x: priorityX + priorityW,
        y: itemY,
        distance: Math.abs(priorityX + priorityW - itemX),
      },
      {
        x: priorityX - itemW,
        y: itemY,
        distance: Math.abs(priorityX - itemW - itemX),
      },
      {
        x: itemX,
        y: priorityY + priorityH,
        distance: Math.abs(priorityY + priorityH - itemY),
      },
      {
        x: itemX,
        y: priorityY - itemH,
        distance: Math.abs(priorityY - itemH - itemY),
      },
      {
        x: priorityX + priorityW,
        y: priorityY,
        distance:
          Math.abs(priorityX + priorityW - itemX) + Math.abs(priorityY - itemY),
      },
      {
        x: priorityX - itemW,
        y: priorityY,
        distance:
          Math.abs(priorityX - itemW - itemX) + Math.abs(priorityY - itemY),
      },
    ]

    // Filter out invalid positions
    const validPositions = potentialPositions.filter(
      pos =>
        pos.x >= 0 &&
        pos.y >= 0 &&
        this.isAreaAvailable(pos.x, pos.y, itemW, itemH, excludeId)
    )

    if (validPositions.length === 0) {
      return this.findOptimalPosition(itemW, itemH)
    }

    // Return the position with the smallest movement distance
    return validPositions.reduce((best, current) =>
      current.distance < best.distance ? current : best
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
    this.items = []
    layout.forEach(item => this.addItem(item.type, item))
  }

  triggerRedraw(id?: number) {
    const ts = Date.now()
    this.items.forEach(item => {
      if (id === undefined || item.id === id) {
        item.redrawTimestamp = ts
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
    this.items = []
    layout.forEach(item => this.addItem(item.type, item))
  }

  /**
   * Resolves conflicts by moving colliding items to available positions with minimal movement
   */
  resolveItemPositionCollisions(priorityItemId: number): Array<{
    itemId: number
    settings: Partial<AllGridTypes>
  }> {
    const priorityItem = this.positions.find(i => i.id === priorityItemId)
    if (!priorityItem) return []

    const collisions = this.findCollisions(
      priorityItem.x,
      priorityItem.y,
      priorityItem.w,
      priorityItem.h,
      priorityItem.id
    )

    if (collisions.size === 0) return []

    const commands: Array<{ itemId: number; settings: Partial<AllGridTypes> }> =
      []

    for (const itemId of collisions) {
      const item = this.items.find(i => i.id === itemId)
      if (!item) continue

      const bestPosition = this.findBestConflictResolutionPosition(
        item,
        priorityItem,
        itemId
      )

      if (
        bestPosition &&
        (bestPosition.x !== item.x || bestPosition.y !== item.y)
      ) {
        commands.push({
          itemId,
          settings: { x: bestPosition.x, y: bestPosition.y },
        })
      }
    }

    return commands
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
