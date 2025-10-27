import { writable, get, derived } from 'svelte/store'
import type { AllGridTypes } from '$lib/workspace/type/gridType'
// Import necessary dependencies moved from Workspace.svelte
import { getVisualizationConfig } from '$lib/workspace/const'
import { DEFAULT_GRID_CONFIG } from '$lib/shared/utils/gridSizingUtils'
import { generateUniqueId } from '$lib/shared/utils/idUtils'

export const gridStore = createGridStore(DEFAULT_GRID_CONFIG)

/**
 * Default grid state data that defines the initial layout of visualizations.
 * This is used when no custom grid items are provided.
 * Only partial grid items are provided, as the store will apply the defaults for the rest.
 */
export const DEFAULT_GRID_STATE_DATA: Array<
  Partial<AllGridTypes> & { type: string }
> = [
  { type: 'scarf', x: 0, y: 0 },
  { type: 'TransitionMatrix', x: 20, y: 0, w: 11, h: 12 },
  { type: 'barPlot', x: 0, y: 12, w: 11, h: 12 },
]

/**
 * Initializes the grid state by directly adding items to the store.
 * This function will clear the current store state and add either the provided items
 * or the default grid state items one by one.
 *
 * Items are added sequentially rather than in bulk to ensure proper collision resolution.
 * Each item's position is validated and adjusted if necessary through the store's
 * addItem method, which handles collision detection and resolution. This ensures
 * that items are placed optimally even if their initial positions would cause overlaps.
 *
 * @param store - The grid store instance to initialize
 * @param gridItems - Optional array of custom grid items to initialize with.
 *                    If null or undefined, uses the default grid state.
 *
 * @example
 * // Use default layout
 * initializeGridState(gridStore)
 *
 * // Use custom layout
 * initializeGridState(gridStore, [
 *   { type: 'scarf', x: 0, y: 0 },
 *   { type: 'barPlot', x: 5, y: 0, w: 8, h: 8 }
 * ])
 */
export function initializeGridState(
  store: ReturnType<typeof createGridStore>,
  gridItems: Array<Partial<AllGridTypes> & { type: string }> | null = null
): void {
  // Clear current store state
  store.reset([])

  console.log('gridItems', gridItems)

  // Add items one by one
  const itemsToAdd = gridItems ?? DEFAULT_GRID_STATE_DATA
  console.log('itemsToAdd', itemsToAdd)
  itemsToAdd.forEach(item => {
    store.addItem(item.type, item)
  })
  console.log('store', get(store))
}

export function initializeGridStateStore(
  gridItems: Array<Partial<AllGridTypes> & { type: string }> | null = null
): void {
  initializeGridState(gridStore, gridItems)
}

export interface GridItemPosition {
  id: number
  x: number
  y: number
  w: number
  h: number
}

export interface GridConfig {
  cellSize: {
    width: number
    height: number
  }
  gap: number
  minWidth: number
  minHeight: number
}

export type GridStoreType = ReturnType<typeof createGridStore>

// --- Internal Utility Functions ---

/**
 * Checks if two rectangles overlap
 */
function rectanglesOverlap(
  x1: number, y1: number, w1: number, h1: number,
  x2: number, y2: number, w2: number, h2: number
): boolean {
  return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2
}

/**
 * Creates a Svelte store for managing a grid layout with item manipulation features.
 *
 * Provides methods for adding, removing, duplicating, moving, and resizing items,
 * along with automatic collision detection and resolution.
 *
 * @param config Grid configuration settings (cellSize, gap, min dimensions).
 * @param initialItemsData Optional array of initial item data (type and partial settings) to populate the grid.
 * @returns A Svelte store object with grid management methods.
 */
export function createGridStore(
  config: GridConfig,
  initialItemsData: Array<Partial<AllGridTypes> & { type: string }> = [] // Accept initial data instead of full items
) {
  /**
   * Creates a grid item with appropriate defaults for the given visualization type
   */
  function createGridItemFromData(
    type: string,
    options: Partial<AllGridTypes> = {}
  ): AllGridTypes {
    // Get configuration for this visualization type
    const vizConfig = getVisualizationConfig(type)

    // Generate a new ID if not provided
    const newId = options.id ?? generateUniqueId()

    // Set initial timestamp for redrawing
    const initialTimestamp = Date.now()

    // Create base properties common to all grid items
    const baseProperties = {
      id: newId,
      x: options.x ?? 0,
      y: options.y ?? 0,
      w: options.w ?? vizConfig.getDefaultWidth(options.stimulusId ?? 0),
      h: options.h ?? vizConfig.getDefaultHeight(options.stimulusId ?? 0),
      min: options.min ?? vizConfig.getDefaultConfig().min,
      type,
      redrawTimestamp: initialTimestamp,
    }

    // Merge defaults with provided options
    return {
      ...baseProperties,
      ...vizConfig.getDefaultConfig(options), // Apply viz-specific defaults
      ...options, // Apply user overrides
    } as AllGridTypes
  }

  const items = writable<AllGridTypes[]>([])
  const positions = derived(items, $items =>
    $items.map(item => ({
      id: item.id,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
    }))
  )

  // Initialize with provided data
  initialItemsData.forEach(itemData => {
    addItem(itemData.type, itemData)
  })

  // --- Core Collision Detection Logic ---

  /**
   * Checks if an area is available (no collisions with existing items)
   */
  function isAreaAvailable(
    x: number,
    y: number,
    w: number,
    h: number,
    excludeId: number = -1
  ): boolean {
    if (x < 0 || y < 0) return false
    
    const itemsToCheck = get(positions)
    for (const item of itemsToCheck) {
      if (item.id === excludeId) continue
      if (rectanglesOverlap(x, y, w, h, item.x, item.y, item.w, item.h)) {
        return false
      }
    }
    return true
  }

  /**
   * Finds all items that collide with a given area
   */
  function findCollisions(
    x: number,
    y: number,
    w: number,
    h: number,
    excludeId: number = -1
  ): Set<number> {
    const collisions = new Set<number>()
    const itemsToCheck = get(positions)
    
    for (const item of itemsToCheck) {
      if (item.id === excludeId) continue
      if (rectanglesOverlap(x, y, w, h, item.x, item.y, item.w, item.h)) {
        collisions.add(item.id)
      }
    }
    return collisions
  }

  // --- Position Finding Logic ---

  /**
   * Finds the lowest available Y position for an item at given x coordinate
   */
  function findLowestAvailableY(
    x: number,
    startY: number,
    w: number,
    h: number,
    excludeId: number = -1
  ): number {
    const itemsToCheck = get(positions)
    let y = startY
    
    // Try positions starting from startY, moving down
    while (y < 100) { // Reasonable limit
      if (isAreaAvailable(x, y, w, h, excludeId)) {
        return y
      }
      y++
    }
    
    // Fallback: find the bottom of all items and place below
    const maxY = itemsToCheck.length > 0 
      ? Math.max(...itemsToCheck.map(item => item.y + item.h))
      : 0
    return maxY
  }

  /**
   * Finds an optimal position for a new item
   */
  function findOptimalPosition(
    w: number,
    h: number,
    referenceItem?: GridItemPosition
  ): { x: number; y: number } {
    const currentItems = get(positions)
    const width = Math.max(config.minWidth, w || config.minWidth)
    const height = Math.max(config.minHeight, h || config.minHeight)

    if (currentItems.length === 0) {
      return { x: 0, y: 0 }
    }

    // Try relative positioning for duplicates
    if (referenceItem) {
      const { x: origX, y: origY, w: origW, h: origH } = referenceItem
      
      // Try right of original
      if (isAreaAvailable(origX + origW, origY, width, height)) {
        return { x: origX + origW, y: origY }
      }
      
      // Try below original
      if (isAreaAvailable(origX, origY + origH, width, height)) {
        return { x: origX, y: origY + origH }
      }
    }

    // Calculate available workspace width in grid cells
    // Use window width as the base and convert to grid cells
    const cellWidth = config.cellSize.width + config.gap
    const availableWorkspaceWidth = Math.floor(window.innerWidth / cellWidth)
    const maxX = Math.max(availableWorkspaceWidth, ...currentItems.map(item => item.x + item.w))
    
    // Find first available spot by scanning within available workspace
    const maxY = Math.max(0, ...currentItems.map(item => item.y + item.h))
    
    // Scan existing area first, constrained to available workspace width
    for (let y = 0; y <= maxY; y++) {
      for (let x = 0; x <= maxX - width; x++) {
        if (isAreaAvailable(x, y, width, height)) {
          return { x, y }
        }
      }
    }
    
    // If no space found, place below existing items
    return { x: 0, y: maxY }
  }

  // --- Conflict Resolution Logic ---

  /**
   * Resolves conflicts by moving colliding items to available positions with minimal movement
   */
  function resolveGridConflicts(priorityItem: {
    id: number
    x: number
    y: number
    w: number
    h: number
  }): Array<{itemId: number, settings: Partial<AllGridTypes>}> {
    const collisions = findCollisions(
      priorityItem.x,
      priorityItem.y,
      priorityItem.w,
      priorityItem.h,
      priorityItem.id
    )

    if (collisions.size === 0) return []

    const commands: Array<{itemId: number, settings: Partial<AllGridTypes>}> = []
    const currentItems = get(items)
    
    for (const itemId of collisions) {
      const item = currentItems.find(i => i.id === itemId)
      if (!item) continue
      
      // Find the best position with minimal movement
      const bestPosition = findBestConflictResolutionPosition(item, priorityItem, itemId)
      
      if (bestPosition && (bestPosition.x !== item.x || bestPosition.y !== item.y)) {
        commands.push({
          itemId,
          settings: { x: bestPosition.x, y: bestPosition.y }
        })
      }
    }
    
    return commands
  }

  /**
   * Finds the best position to resolve a conflict with minimal movement
   */
  function findBestConflictResolutionPosition(
    item: AllGridTypes,
    priorityItem: { x: number; y: number; w: number; h: number },
    excludeId: number
  ): { x: number; y: number } | null {
    const { x: itemX, y: itemY, w: itemW, h: itemH } = item
    const { x: priorityX, y: priorityY, w: priorityW, h: priorityH } = priorityItem
    
    // Calculate movement distances for each direction
    const positions = [
      // Move right of priority item
      { x: priorityX + priorityW, y: itemY, distance: Math.abs(priorityX + priorityW - itemX) },
      // Move left of priority item
      { x: priorityX - itemW, y: itemY, distance: Math.abs(priorityX - itemW - itemX) },
      // Move below priority item
      { x: itemX, y: priorityY + priorityH, distance: Math.abs(priorityY + priorityH - itemY) },
      // Move above priority item
      { x: itemX, y: priorityY - itemH, distance: Math.abs(priorityY - itemH - itemY) },
      // Move to the right edge of priority item
      { x: priorityX + priorityW, y: priorityY, distance: Math.abs(priorityX + priorityW - itemX) + Math.abs(priorityY - itemY) },
      // Move to the left edge of priority item
      { x: priorityX - itemW, y: priorityY, distance: Math.abs(priorityX - itemW - itemX) + Math.abs(priorityY - itemY) }
    ]
    
    // Filter out invalid positions (negative coordinates or outside workspace)
    const validPositions = positions.filter(pos => 
      pos.x >= 0 && pos.y >= 0 && 
      isAreaAvailable(pos.x, pos.y, itemW, itemH, excludeId)
    )
    
    if (validPositions.length === 0) {
      // Fallback: find any available position
      const fallbackPos = findOptimalPosition(itemW, itemH)
      return fallbackPos
    }
    
    // Return the position with the smallest movement distance
    return validPositions.reduce((best, current) => 
      current.distance < best.distance ? current : best
    )
  }

  // --- Public Store Methods ---

  /**
   * Duplicates an existing grid item
   */
  function duplicateItem(item: AllGridTypes, duplicateId?: number) {
    const newId = duplicateId ?? generateUniqueId()
    const newPosition = findOptimalPosition(item.w, item.h, item)

    const newItem = {
      ...item,
      id: newId,
      x: newPosition.x,
      y: newPosition.y,
    }

    items.update($items => [...$items, newItem])
    return newId
  }

  /**
   * Duplicates multiple items
   */
  function batchDuplicateItems(itemsToClone: AllGridTypes[]) {
    if (itemsToClone.length === 0) return []

    const newIds: number[] = []
    const newItems: AllGridTypes[] = []

    for (const item of itemsToClone) {
      const newId = generateUniqueId()
      newIds.push(newId)

      const newPosition = findOptimalPosition(item.w, item.h, item)
      const newItem = {
        ...item,
        id: newId,
        x: newPosition.x,
        y: newPosition.y,
      }
      newItems.push(newItem)
    }

    items.update($items => [...$items, ...newItems])
    return newIds
  }

  /**
   * Resolves position based on user preferences or falls back to suggested position
   */
  function resolveRequestedPosition(
    opts: Partial<AllGridTypes>,
    suggested: { x: number; y: number },
    dims: { w: number; h: number }
  ): { x: number; y: number } {
    const { w, h } = dims

    // Both x and y specified - use if available, otherwise fall back
    if (opts.x !== undefined && opts.y !== undefined) {
      return isAreaAvailable(opts.x, opts.y, w, h)
        ? { x: opts.x, y: opts.y }
        : suggested
    }

    // Only x specified - find lowest y in that column
    if (opts.x !== undefined) {
      const y = findLowestAvailableY(opts.x, 0, w, h)
      return { x: opts.x, y }
    }

    // Only y specified - find first available x in that row
    if (opts.y !== undefined) {
      for (let x = 0; x < 30; x++) {
        if (isAreaAvailable(x, opts.y, w, h)) {
          return { x, y: opts.y }
        }
      }
    }

    // No specific position requested - use suggested
    return suggested
  }

  /**
   * Adds a new item by type and options
   */
  function addItem(
    type: string,
    options: Partial<AllGridTypes> = {}
  ) {
    const newItemData = createGridItemFromData(type, options)
    const suggested = findOptimalPosition(newItemData.w, newItemData.h)
    const { x, y } = resolveRequestedPosition(options, suggested, newItemData)
    const newItem = { ...newItemData, x, y }

    items.update($ => [...$, newItem])
    return newItem.id
  }

  // Store API
  return {
    subscribe: items.subscribe,
    set: (newItems: AllGridTypes[]) => items.set(newItems),
    update: (updater: (items: AllGridTypes[]) => AllGridTypes[]) => items.update(updater),

    triggerRedraw: (id?: number) => {
      const timestamp = Date.now()
      items.update($items =>
        id !== undefined
          ? $items.map(item =>
              item.id === id ? { ...item, redrawTimestamp: timestamp } : item
            )
          : $items.map(item => ({ ...item, redrawTimestamp: timestamp }))
      )
    },

    reset: (newInitialItemsData: Array<Partial<AllGridTypes> & { type: string }>) => {
      const newItems = newInitialItemsData.map(itemData =>
        createGridItemFromData(itemData.type, itemData)
      )
      items.set(newItems)
    },

    /**
     * Sets the entire layout state to the provided layout items.
     * This is used for layout reset operations and undo/redo functionality.
     * However, it checks for collisions and resolves them before setting the new state.
     * 
     * @param layoutState - Array of layout items to set as the new state
     */
    setLayoutState: (layoutState: Array<Partial<AllGridTypes> & { type: string }>) => {
      items.set([])
      layoutState.forEach(itemData => {
        addItem(itemData.type, itemData) // This will check for collisions and resolve them
      })
    },

    updateSettings: (settings: AllGridTypes) => {
      items.update($items =>
        $items.map(item =>
          item.id === settings.id ? { ...item, ...settings } : item
        )
      )
    },
    removeItem: (id: number) => {
      items.update($items => $items.filter(item => item.id !== id))
    },
    duplicateItem,
    batchDuplicateItems,
    addItem,

    /**
     * Resolves position collisions for a specific item
     */
    resolveItemPositionCollisions: (id: number) => {
      const item = get(items).find(item => item.id === id)
      if (!item) return []
      return resolveGridConflicts(item)
    },
  }
}

