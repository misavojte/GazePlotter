import { writable, get, derived } from 'svelte/store'
import type { AllGridTypes } from '$lib/workspace/type/gridType'
// Import necessary dependencies moved from Workspace.svelte
import { getVisualizationConfig } from '$lib/workspace/const'
import { DEFAULT_GRID_CONFIG } from '$lib/shared/utils/gridSizingUtils'

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

// Helper function to calculate overlap area between two grid items
function calculateOverlapArea(
  item1: GridItemPosition,
  item2: GridItemPosition
): number {
  const xOverlap = Math.max(
    0,
    Math.min(item1.x + item1.w, item2.x + item2.w) - Math.max(item1.x, item2.x)
  )
  const yOverlap = Math.max(
    0,
    Math.min(item1.y + item1.h, item2.y + item2.h) - Math.max(item1.y, item2.y)
  )
  return xOverlap * yOverlap
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
  // --- Private Helper Functions ---

  /** Generates a new unique ID based on timestamp and random number. */
  // Generate a new unique ID (kept internal)
  function getNewId() {
    return Date.now() + Math.floor(Math.random() * 1000)
  }

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
    const newId = options.id ?? getNewId()

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

  // Initialize the store by creating items from the initial data
  const initialItems = initialItemsData.map(itemData =>
    createGridItemFromData(itemData.type, itemData)
  )

  // Create the main store
  const items = writable<AllGridTypes[]>([])

  // Create a derived store for grid positions only (for collision detection)
  const positions = derived(items, $items =>
    $items.map(item => ({
      id: item.id,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
    }))
  )

  initialItems.forEach(item => {
    addItem(item.type, item)
  })

  // --- Core Collision Detection Logic ---

  /**
   * Core collision detection function.
   * Checks if a given area (defined by x, y, w, h) collides with existing items.
   * Can return a boolean indicating if *any* collision occurs, or a Set of IDs of *all* colliding items.
   *
   * @param x The starting X coordinate of the area to check.
   * @param y The starting Y coordinate of the area to check.
   * @param w The width of the area to check.
   * @param h The height of the area to check.
   * @param options Configuration options:
   *   - excludeIds: A Set or single ID of items to ignore during collision checks.
   *   - itemsToCheck: An optional array of items to check against (defaults to current store state).
   *   - returnCollidingIds: If true, returns a Set<number> of colliding IDs. If false (default), returns boolean.
   * @returns {boolean | Set<number>} True if collision detected (and returnCollidingIds is false),
   *                                   false if no collision (and returnCollidingIds is false),
   *                                   or a Set<number> of colliding IDs (if returnCollidingIds is true).
   */
  function detectCollisions(
    x: number,
    y: number,
    w: number,
    h: number,
    options: {
      excludeIds?: Set<number> | number
      itemsToCheck?: GridItemPosition[]
      returnCollidingIds?: boolean // If true, returns Set<number>
    } = {}
  ): boolean | Set<number> {
    const {
      excludeIds = -1,
      itemsToCheck,
      returnCollidingIds = false, // Default to returning boolean
    } = options

    // Process excludeIds
    const excludeIdSet =
      typeof excludeIds === 'number'
        ? excludeIds >= 0
          ? new Set([excludeIds])
          : new Set<number>()
        : excludeIds

    const itemsToProcess = itemsToCheck || get(positions)
    const collisionIds = new Set<number>()

    for (const item of itemsToProcess) {
      if (excludeIdSet.has(item.id)) continue

      // Optimized rectangle intersection test
      if (
        x < item.x + item.w &&
        x + w > item.x &&
        y < item.y + item.h &&
        y + h > item.y
      ) {
        if (!returnCollidingIds) {
          return true // Early return: collision detected
        }
        collisionIds.add(item.id)
      }
    }

    return returnCollidingIds ? collisionIds : false // Return Set or boolean
  }

  /** Checks if a rectangular area in the grid is free from collisions. */
  // Check if an area is available (no collisions)
  function isAreaAvailable(
    x: number,
    y: number,
    w: number,
    h: number,
    excludeId: number = -1
  ): boolean {
    if (x < 0 || y < 0) return false
    // Use the core detector, expecting a boolean result
    return !detectCollisions(x, y, w, h, { excludeIds: excludeId }) as boolean
  }

  /** Finds all items that collide with a given rectangular area. */
  // Find all items colliding with the given area
  function findCollisions(
    x: number,
    y: number,
    w: number,
    h: number,
    excludeId: number = -1
  ): Set<number> {
    // Use the core detector, expecting a Set result
    return detectCollisions(x, y, w, h, {
      excludeIds: excludeId,
      returnCollidingIds: true,
    }) as Set<number>
  }

  // --- Position Finding Logic ---

  /**
   * Helper function used by conflict resolution.
   * Finds the lowest Y coordinate at or below startY where an item of size w,h
   * can be placed at horizontal coordinate x without colliding with itemsToCheck (excluding excludeIds).
   *
   * @returns The lowest available Y coordinate, or null if no spot is found within reasonable checks.
   */
  // Helper to find the lowest Y that doesn't cause collisions (used by resolveGridConflicts)
  function findLowestAvailableY(
    x: number,
    startY: number,
    w: number,
    h: number,
    itemsToCheck: GridItemPosition[],
    excludeIds: Set<number>
  ): number | null {
    const sortedItems = [...itemsToCheck]
      .filter(item => !excludeIds.has(item.id))
      .sort((a, b) => a.y - b.y)

    if (sortedItems.length === 0) return startY

    // Check if the starting position works
    if (
      !detectCollisions(x, startY, w, h, {
        excludeIds,
        itemsToCheck: sortedItems,
      })
    ) {
      return startY
    }

    const potentialYPositions = sortedItems
      .map(item => item.y + item.h)
      .filter(y => y >= startY) // Ensure we check positions at or below startY
      .sort((a, b) => a - b)

    // Add startY itself if not already present from item bottoms
    if (!potentialYPositions.includes(startY)) {
      potentialYPositions.unshift(startY)
      potentialYPositions.sort((a, b) => a - b)
    }

    for (const y of potentialYPositions) {
      if (
        !detectCollisions(x, y, w, h, { excludeIds, itemsToCheck: sortedItems })
      ) {
        return y
      }
    }

    // Fallback: position below the absolute lowest item
    const maxY = Math.max(0, ...itemsToCheck.map(item => item.y + item.h))
    return maxY
  }

  /**
   * Unified position finder.
   * Finds an optimal empty spot in the grid for an item of given dimensions.
   * Uses different strategies based on the 'strategy' option.
   *
   * Strategies:
   * - 'new': Finds the first available spot by scanning left-to-right, top-to-bottom,
   *            preferring to fill gaps before expanding the grid downwards or rightwards.
   * - 'duplicate': Attempts to place the item relative to a `referenceItem`
   *                  (first right, then below, then below-left). Falls back to 'new' if relative positions fail.
   *
   * @param w Width of the item to place.
   * @param h Height of the item to place.
   * @param options Configuration:
   *   - referenceItem: The original item when using the 'duplicate' strategy.
   *   - strategy: 'new' or 'duplicate'.
   *   - maxGridWidth: Optional limit for horizontal scanning to prevent excessive width.
   * @returns An object { x: number, y: number } with the calculated top-left coordinates.
   */
  function findOptimalPosition(
    w: number,
    h: number,
    options: {
      referenceItem?: GridItemPosition // Used for 'duplicate' strategy
      strategy?: 'new' | 'duplicate'
      maxGridWidth?: number
    } = {}
  ): { x: number; y: number } {
    const {
      referenceItem,
      strategy = 'new',
      maxGridWidth = 30, // Limit horizontal scanning
    } = options

    const currentItems = get(positions)
    const width = Math.max(config.minWidth, w || config.minWidth)
    const height = Math.max(config.minHeight, h || config.minHeight)

    if (currentItems.length === 0) {
      return { x: 0, y: 0 } // Grid is empty
    }

    // --- Strategy: Duplicate ---
    if (strategy === 'duplicate' && referenceItem) {
      const { x: origX, y: origY, w: origW, h: origH } = referenceItem
      const canPlaceRight = origX + origW < maxGridWidth

      const positionsToTry = [
        // Right of original (if within bounds)
        ...(canPlaceRight ? [{ x: origX + origW, y: origY }] : []),
        // Below original
        { x: origX, y: origY + origH },
        // Below, aligned left (if space allows)
        ...(origX > 0 ? [{ x: 0, y: origY + origH }] : []),
      ]

      for (const pos of positionsToTry) {
        if (isAreaAvailable(pos.x, pos.y, width, height)) {
          return pos
        }
      }
      // Fallback to 'new' strategy if relative positions fail
    }

    // --- Strategy: New (or fallback from Duplicate) ---
    let maxOccupiedX = 0
    let maxOccupiedY = 0
    if (currentItems.length > 0) {
      maxOccupiedX = Math.max(0, ...currentItems.map(item => item.x + item.w))
      maxOccupiedY = Math.max(0, ...currentItems.map(item => item.y + item.h))
    }

    // Scan existing rows first to fill gaps
    for (let scanY = 0; scanY <= maxOccupiedY; scanY++) {
      for (
        let scanX = 0;
        scanX < Math.min(maxGridWidth, maxOccupiedX + 1);
        scanX++
      ) {
        if (isAreaAvailable(scanX, scanY, width, height)) {
          return { x: scanX, y: scanY }
        }
      }
    }

    // If no gaps, try adding below existing items (limited horizontal scan)
    for (let scanX = 0; scanX < Math.min(10, maxGridWidth); scanX++) {
      if (isAreaAvailable(scanX, maxOccupiedY, width, height)) {
        return { x: scanX, y: maxOccupiedY }
      }
    }

    // If still no spot, expand grid scan more broadly (vertical priority)
    for (let scanY = maxOccupiedY + 1; scanY < maxOccupiedY + 10; scanY++) {
      for (let scanX = 0; scanX < Math.min(15, maxGridWidth); scanX++) {
        if (isAreaAvailable(scanX, scanY, width, height)) {
          return { x: scanX, y: scanY }
        }
      }
    }

    // Absolute fallback: place bottom-left of the max occupied area
    console.warn(
      'Grid placement fallback triggered. Consider increasing scan range or grid size.'
    )
    return { x: 0, y: maxOccupiedY }
  }

  // --- Conflict Resolution Logic ---

  /**
   * Resolves conflicts when an item (priorityItem) overlaps with others.
   * Attempts to move the *other* colliding items downward or find alternative spots.
   * Prioritizes moving items with less overlap and higher vertical position first.
   *
   * @param priorityItem The item causing potential conflicts (e.g., just added or moved/resized).
   *                     Includes its current position, dimensions, ID, and the operation type.
   * @returns {boolean} True if any conflicts were resolved (items were moved), false otherwise.
   */
  function resolveGridConflicts(priorityItem: {
    id: number
    x: number
    y: number
    w: number
    h: number
    operation: 'move' | 'resize' | 'add' | 'duplicate'
  }): boolean {
    const primaryCollisions = findCollisions(
      priorityItem.x,
      priorityItem.y,
      priorityItem.w,
      priorityItem.h,
      priorityItem.id
    )

    if (primaryCollisions.size === 0) return false // No conflicts

    let workingItems = [...get(items)] // Use full items for updates
    const currentPriorityItem = workingItems.find(
      item => item.id === priorityItem.id
    )
    if (!currentPriorityItem) return false

    const itemsToReposition = workingItems
      .filter(item => primaryCollisions.has(item.id))
      .sort((a, b) => {
        // Sort criteria (simplified for clarity)
        const overlapA = calculateOverlapArea(currentPriorityItem, a)
        const overlapB = calculateOverlapArea(currentPriorityItem, b)
        if (overlapA !== overlapB) return overlapA - overlapB // Less overlap first
        return a.y - b.y // Higher items first
      })

    let changesMade = false
    for (const itemToMove of itemsToReposition) {
      const currentItemToMove = workingItems.find(i => i.id === itemToMove.id)!
      let bestPosition: { x: number; y: number } | null = null

      // Try moving directly below the priority item
      const belowY = currentPriorityItem.y + currentPriorityItem.h
      if (
        !detectCollisions(
          currentItemToMove.x,
          belowY,
          currentItemToMove.w,
          currentItemToMove.h,
          {
            excludeIds: new Set([itemToMove.id, priorityItem.id]),
            itemsToCheck: workingItems, // Check against the current state of workingItems
          }
        )
      ) {
        bestPosition = { x: currentItemToMove.x, y: belowY }
      } else {
        // If below doesn't work, find the lowest available Y
        const lowestY = findLowestAvailableY(
          currentItemToMove.x,
          belowY, // Start searching from below the priority item
          currentItemToMove.w,
          currentItemToMove.h,
          workingItems,
          new Set([itemToMove.id, priorityItem.id])
        )
        if (lowestY !== null) {
          bestPosition = { x: currentItemToMove.x, y: lowestY }
        }
      }

      // If a vertical move wasn't found, try finding *any* optimal position as a last resort
      if (!bestPosition) {
        bestPosition = findOptimalPosition(
          currentItemToMove.w,
          currentItemToMove.h,
          { strategy: 'new' }
        )
      }

      // Update workingItems if a new position was found and it's different
      if (
        bestPosition &&
        (bestPosition.x !== currentItemToMove.x ||
          bestPosition.y !== currentItemToMove.y)
      ) {
        workingItems = workingItems.map(item =>
          item.id === itemToMove.id
            ? { ...item, x: bestPosition!.x, y: bestPosition!.y }
            : item
        )
        changesMade = true
      }
    }

    // Apply all changes at once if any were made
    if (changesMade) {
      items.set(workingItems)
    }

    return changesMade
  }

  // --- Public Store Methods ---

  /** Duplicates an existing grid item, finding an optimal position for the clone. */
  // Duplicate an item
  function duplicateItem(item: AllGridTypes) {
    const newId = getNewId()
    const newPosition = findOptimalPosition(item.w, item.h, {
      referenceItem: item,
      strategy: 'duplicate',
    })

    const newItem = {
      ...item,
      id: newId,
      x: newPosition.x,
      y: newPosition.y,
    }

    items.update($items => [...$items, newItem])
    resolveGridConflicts({ ...newItem, operation: 'duplicate' })
    return newId
  }

  /** Duplicates multiple items efficiently, attempting to place them relative to their originals. */
  // Batch duplicate multiple items
  function batchDuplicateItems(itemsToClone: AllGridTypes[]) {
    if (itemsToClone.length === 0) return []

    const newIds: number[] = []
    const newItems: AllGridTypes[] = []
    let workingSet = [...get(items)] // Start with current items

    for (const item of itemsToClone) {
      const newId = getNewId()
      newIds.push(newId)

      // Find position considering items already processed in this batch
      const newPosition = findOptimalPosition(item.w, item.h, {
        referenceItem: item,
        strategy: 'duplicate',
      })

      const newItem = {
        ...item,
        id: newId,
        x: newPosition.x,
        y: newPosition.y,
      }
      newItems.push(newItem)
      // Add to working set for subsequent placement checks in this batch
      workingSet.push(newItem)
    }

    // Add all new items to the real store
    items.update($items => [...$items, ...newItems])

    // Resolve conflicts for each new item (consider doing this within the loop?)
    // Process in reverse order might be better, but let's stick to forward for now.
    newItems.forEach(newItem => {
      resolveGridConflicts({ ...newItem, operation: 'duplicate' })
    })

    return newIds
  }

  /**
   * Adds a new item of the specified type to the grid.
   * Creates the item, finds an optimal position, adds it to the store, and resolves conflicts.
   *
   * @param type The type identifier of the visualization to add.
   * @param options Optional partial configuration/settings for the new item.
   * @returns {number} The ID of the newly added item.
   */
  // Add a new item - now accepts type and options, handles creation internally
  function addItem(type: string, options: Partial<AllGridTypes> = {}) {
    // 1. Create the full item object using the internal helper
    const newItemData = createGridItemFromData(type, options)

    // 2. Find an optimal position for the new item, but respect provided y if it exists
    const newPosition =
      options.y !== undefined
        ? {
            x: findOptimalPosition(newItemData.w, newItemData.h, {
              strategy: 'new',
            }).x,
            y: options.y,
          }
        : findOptimalPosition(newItemData.w, newItemData.h, { strategy: 'new' })

    // 3. Create the final item with the calculated position
    const newItem = {
      ...newItemData,
      id: newItemData.id,
      x: newPosition.x,
      y: newPosition.y,
    }

    // 4. Add to store and resolve conflicts
    items.update($items => [...$items, newItem])
    resolveGridConflicts({ ...newItem, operation: 'add' })

    // Return the ID of the newly added item
    return newItem.id
  }

  // Store API
  return {
    subscribe: items.subscribe,
    /** Directly sets the store's internal items array. Use with caution. */
    set: (newItems: AllGridTypes[]) => {
      items.set(newItems)
    },
    /** Updates the store's internal items array using an updater function. */
    update: (updater: (items: AllGridTypes[]) => AllGridTypes[]) => {
      items.update(updater)
    },

    /**
     * Triggers a redraw by updating the redrawTimestamp of all items or a specific item.
     * @param id Optional ID of a specific item to redraw. If not provided, all items will be redrawn.
     */
    triggerRedraw: (id?: number) => {
      const timestamp = Date.now()
      items.update($items => {
        if (id !== undefined) {
          // Update only the specified item
          return $items.map(item =>
            item.id === id ? { ...item, redrawTimestamp: timestamp } : item
          )
        } else {
          // Update all items
          return $items.map(item => ({ ...item, redrawTimestamp: timestamp }))
        }
      })
    },

    /**
     * Resets the grid state by creating items from the provided data array
     * and replacing the entire store content.
     */
    reset: (
      newInitialItemsData: Array<Partial<AllGridTypes> & { type: string }>
    ) => {
      const newItems = newInitialItemsData.map(itemData =>
        // Use the internal creation helper, assuming initial data has intended positions
        createGridItemFromData(itemData.type, itemData)
      )
      // TODO: Optionally run placement/collision checks if initial data *doesn't* guarantee valid positions
      items.set(newItems) // Set the state in one go
    },

    /** Updates the settings/configuration of a specific grid item. */
    // Update item settings
    updateSettings: (settings: AllGridTypes) => {
      items.update($items =>
        $items.map(item =>
          item.id === settings.id ? { ...item, ...settings } : item
        )
      )
    },

    /** Removes an item from the grid by its ID. */
    // Remove an item
    removeItem: (id: number) => {
      items.update($items => $items.filter(item => item.id !== id))
    },

    /** Duplicates a specific item by its data. */
    // Duplicate an item
    duplicateItem: duplicateItem,

    /** Duplicates an array of items. */
    // Batch duplicate multiple items at once
    batchDuplicateItems: batchDuplicateItems,

    /** Adds a new item by type and options. */
    // Add a new item - now accepts type and options, handles creation internally
    addItem: addItem,

    /**
     * Updates the position (x, y) of a specific item.
     * Optionally resolves collisions caused by the move.
     */
    // Update item position
    updateItemPosition: (
      id: number,
      x: number,
      y: number,
      shouldResolveCollisions: boolean = true
    ) => {
      const currentItems = get(items)
      const item = currentItems.find(item => item.id === id)
      if (!item) return

      const newX = Math.max(0, Math.floor(x))
      const newY = Math.max(0, Math.floor(y))

      if (newX === item.x && newY === item.y) return

      items.update($items =>
        $items.map(i => (i.id === id ? { ...i, x: newX, y: newY } : i))
      )

      if (shouldResolveCollisions) {
        resolveGridConflicts({ ...item, x: newX, y: newY, operation: 'move' })
      }
    },

    /**
     * Updates the size (w, h) of a specific item.
     * Enforces minimum dimensions based on config and item spec.
     * Optionally resolves collisions caused by the resize (if expanding).
     * @returns {boolean} True if the size update was successful (even if no change was needed), false if item not found.
     */
    // Update item size
    updateItemSize: (
      id: number,
      w: number,
      h: number,
      shouldResolveCollisions: boolean = true
    ) => {
      const currentItems = get(items)
      const item = currentItems.find(item => item.id === id)
      if (!item) return false // Return boolean to indicate success/failure

      const minWidth = Math.max(config.minWidth, item.min?.w || config.minWidth)
      const minHeight = Math.max(
        config.minHeight,
        item.min?.h || config.minHeight
      )
      const newW = Math.max(minWidth, Math.floor(w))
      const newH = Math.max(minHeight, Math.floor(h))

      if (newW === item.w && newH === item.h) return true // No change needed

      const isResizingInward = newW <= item.w && newH <= item.h

      items.update($items =>
        $items.map(i => (i.id === id ? { ...i, w: newW, h: newH } : i))
      )

      let conflictsResolved = true
      if (shouldResolveCollisions && !isResizingInward) {
        conflictsResolved = resolveGridConflicts({
          ...item,
          w: newW,
          h: newH,
          operation: 'resize',
        })
      }

      return conflictsResolved // Indicate if operation completed cleanly
    },

    /**
     * Explicitly triggers collision resolution for a specific item.
     * Useful after operations like drag-and-drop end.
     * @returns {boolean} True if conflicts were found and resolved, false otherwise.
     */
    // Explicitly resolve position collisions (e.g., after drag end)
    resolveItemPositionCollisions: (id: number) => {
      const item = get(items).find(item => item.id === id)
      if (!item) return false
      return resolveGridConflicts({ ...item, operation: 'move' })
    },
  }
}
