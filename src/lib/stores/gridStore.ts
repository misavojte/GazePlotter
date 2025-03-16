import { writable, get, derived } from 'svelte/store'
import type { AllGridTypes } from '$lib/type/gridType'

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

export function createGridStore(
  config: GridConfig,
  initialItems: AllGridTypes[] = []
) {
  // Create the main store
  const items = writable<AllGridTypes[]>(initialItems)

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

  // Create a simple matrix map for collision detection
  // This is much simpler than the previous GridMatrix class
  function createOccupancyMap(
    gridItems: GridItemPosition[],
    excludeId: number = -1,
    includeId: number = -1
  ) {
    const map = new Map<string, number>()

    for (const item of gridItems) {
      if (item.id === excludeId) continue
      if (includeId !== -1 && item.id !== includeId) continue

      for (let x = item.x; x < item.x + item.w; x++) {
        for (let y = item.y; y < item.y + item.h; y++) {
          map.set(`${x},${y}`, item.id)
        }
      }
    }

    return map
  }

  // We're removing the cache as it's causing collision detection to fail
  // Instead, optimize the map creation
  function getOccupancyMap(excludeId: number = -1): Map<string, number> {
    // Direct creation of map with latest data - no caching
    const currentPositions = get(positions)
    return createOccupancyMap(currentPositions, excludeId)
  }

  // Check if an area is available (no collisions)
  function isAreaAvailable(
    x: number,
    y: number,
    w: number,
    h: number,
    excludeId: number = -1
  ) {
    if (x < 0 || y < 0) return false

    // Get fresh occupancy map
    const occupancyMap = getOccupancyMap(excludeId)

    // Simplified check - just iterate through each cell in the target area
    for (let i = 0; i < w; i++) {
      for (let j = 0; j < h; j++) {
        if (occupancyMap.has(`${x + i},${y + j}`)) {
          return false
        }
      }
    }

    return true
  }

  // Find collisions for a given area with improved rectangle intersection algorithm
  function findCollisions(
    x: number,
    y: number,
    w: number,
    h: number,
    excludeId: number = -1
  ) {
    const collisionIds = new Set<number>()
    const currentPositions = get(positions)

    for (const item of currentPositions) {
      if (item.id === excludeId) continue

      // Optimized rectangle intersection test
      if (
        x < item.x + item.w &&
        x + w > item.x &&
        y < item.y + item.h &&
        y + h > item.y
      ) {
        collisionIds.add(item.id)
      }
    }

    return collisionIds
  }

  // Enhanced resolveCollisions function to be more careful with vertical space
  function resolveCollisions(
    collisionSet: Set<number>,
    newItem: { x: number; y: number; w: number; h: number; id?: number }
  ) {
    if (collisionSet.size === 0) return

    const currentItems = get(items)
    const itemsToMove = currentItems.filter(item => collisionSet.has(item.id))

    // Sort by proximity to the new item's bottom edge
    // This places closer items first to create a more natural flow
    itemsToMove.sort((a, b) => {
      const distA = Math.abs(a.y - (newItem.y + newItem.h))
      const distB = Math.abs(b.y - (newItem.y + newItem.h))
      return distA - distB
    })

    const bottomEdge = newItem.y + newItem.h

    // We need to make sure items moved down don't cause secondary collisions
    // This requires a more careful approach to shifts
    let updatedItems = [...currentItems]

    // Process each item one by one, updating our working copy
    for (const itemToMove of itemsToMove) {
      // Place the item at the bottom edge of the causing item
      const newPosition = { x: itemToMove.x, y: bottomEdge }

      // Check if this new position causes secondary collisions
      const secondaryCollisions = new Set<number>()

      for (const other of updatedItems) {
        // Skip the item itself and the item that caused the original collision
        if (
          other.id === itemToMove.id ||
          (newItem.id !== undefined && other.id === newItem.id)
        )
          continue

        // Check for collision at the new position
        if (
          newPosition.x < other.x + other.w &&
          newPosition.x + itemToMove.w > other.x &&
          newPosition.y < other.y + other.h &&
          newPosition.y + itemToMove.h > other.y
        ) {
          secondaryCollisions.add(other.id)
        }
      }

      // If we have secondary collisions, try to place it even lower
      if (secondaryCollisions.size > 0) {
        // Find the maximum bottom edge of secondary collisions
        const maxSecondaryBottom = Math.max(
          ...updatedItems
            .filter(item => secondaryCollisions.has(item.id))
            .map(item => item.y + item.h)
        )

        // Update the position to be below all secondary collisions
        newPosition.y = maxSecondaryBottom
      }

      // Update our working copy with the new position
      updatedItems = updatedItems.map(item =>
        item.id === itemToMove.id ? { ...item, y: newPosition.y } : item
      )
    }

    // Now update the store with all our processed items at once
    items.update($items => {
      return $items.map(item => {
        // Find the matching item in our processed list
        const updatedItem = updatedItems.find(u => u.id === item.id)

        // If it was moved, return the updated position
        if (updatedItem && collisionSet.has(item.id)) {
          return { ...item, y: updatedItem.y }
        }

        // Otherwise return the unchanged item
        return item
      })
    })
  }

  // Generate a new unique ID
  function getNewId() {
    return Date.now() + Math.floor(Math.random() * 1000)
  }

  // Calculate the total grid height
  function getGridHeight() {
    const currentItems = get(items)
    if (currentItems.length === 0) return 200

    const maxY = Math.max(...currentItems.map(item => item.y + item.h))
    return Math.max(
      200,
      maxY * (config.cellSize.height + config.gap) + config.gap + 40
    )
  }

  // Find position for duplicated item - improved algorithm
  function findDuplicationPosition(
    originalX: number,
    originalY: number,
    w: number,
    h: number,
    maxGridWidth: number = 100
  ) {
    // First try: to the right of the original
    const rightX = originalX + w
    const maxAllowedX = maxGridWidth - Math.ceil(w * 0.25)

    // Queue of positions to try, in priority order
    const positionsToTry = [
      // Right of original (if within bounds)
      ...(rightX <= maxAllowedX ? [{ x: rightX, y: originalY }] : []),
      // Below original
      { x: originalX, y: originalY + h },
      // Below and left-aligned to grid origin
      ...(originalX > 0 ? [{ x: 0, y: originalY + h }] : []),
      // Diagonally down-right
      { x: originalX + 1, y: originalY + 1 },
    ]

    // Try each position in order
    for (const pos of positionsToTry) {
      if (isAreaAvailable(pos.x, pos.y, w, h)) {
        return pos
      }
    }

    // If no quick suggestions work, do a more thorough search
    return findAvailablePosition(w, h)
  }

  // Improved finder that uses a more efficient algorithm
  function findAvailablePosition(
    w: number,
    h: number,
    preferredX?: number,
    preferredY?: number
  ) {
    const currentItems = get(items)

    // Ensure minimum dimensions
    const width = Math.max(config.minWidth, w || config.minWidth)
    const height = Math.max(config.minHeight, h || config.minHeight)

    const startX = preferredX ?? 0
    const startY = preferredY ?? 0

    // If no items exist or preferred position is available, use that
    if (
      currentItems.length === 0 ||
      (preferredX !== undefined &&
        preferredY !== undefined &&
        isAreaAvailable(preferredX, preferredY, width, height))
    ) {
      return { x: startX, y: startY }
    }

    // Find the lowest occupied position
    const maxY = Math.max(...currentItems.map(item => item.y + item.h))

    // Quick check: bottom of the grid
    if (isAreaAvailable(0, maxY, width, height)) {
      return { x: 0, y: maxY }
    }

    // Use a more intelligent scanning pattern - first try placement near existing items
    // to promote more compact layouts, then fall back to scanning the grid

    // 1. Scan horizontally at existing item bottom edges
    const yPositions = [
      ...new Set(currentItems.map(item => item.y + item.h)),
    ].sort((a, b) => a - b)

    for (const scanY of yPositions) {
      for (let scanX = 0; scanX < 100; scanX += 1) {
        if (isAreaAvailable(scanX, scanY, width, height)) {
          return { x: scanX, y: scanY }
        }
      }
    }

    // 2. Scan grid systematically if needed
    for (let scanY = 0; scanY <= maxY + 1; scanY++) {
      for (let scanX = 0; scanX < 100; scanX++) {
        if (isAreaAvailable(scanX, scanY, width, height)) {
          return { x: scanX, y: scanY }
        }
      }
    }

    // If all else fails, place at the bottom
    return { x: 0, y: maxY + 1 }
  }

  // Duplicate an item
  function duplicateItem(item: AllGridTypes) {
    const newId = getNewId()
    const newPosition = findDuplicationPosition(item.x, item.y, item.w, item.h)

    const newItem = {
      ...item,
      id: newId,
      x: newPosition.x,
      y: newPosition.y,
    }

    items.update($items => [...$items, newItem])

    // Check for collisions after adding
    const collisions = findCollisions(
      newPosition.x,
      newPosition.y,
      item.w,
      item.h,
      newId
    )

    if (collisions.size > 0) {
      resolveCollisions(collisions, {
        x: newPosition.x,
        y: newPosition.y,
        w: item.w,
        h: item.h,
        id: newId, // Ensure we pass the ID so it's excluded from secondary collisions
      })
    }

    return newId
  }

  // Batch duplicate multiple items at once
  function batchDuplicateItems(itemsToClone: AllGridTypes[]) {
    if (itemsToClone.length === 0) return []

    const newIds: number[] = []
    const newItems: AllGridTypes[] = []

    // Create a temporary working set to avoid collisions between new items
    const workingSet = [...get(items)]

    // First pass: calculate positions and create new items one by one
    for (const item of itemsToClone) {
      const newId = getNewId()
      newIds.push(newId)

      // When finding a position, consider previously created duplicates
      const newPosition = findDuplicationPosition(
        item.x,
        item.y,
        item.w,
        item.h
      )

      const newItem = {
        ...item,
        id: newId,
        x: newPosition.x,
        y: newPosition.y,
      }

      // Add to our new items collection
      newItems.push(newItem)

      // Add to working set for collision detection in subsequent iterations
      workingSet.push(newItem)
    }

    // Add all new items at once to the real store
    items.update($items => [...$items, ...newItems])

    // Resolve collisions after all items are added

    // First, handle collisions with existing items
    // For each new item, check if it collides with any existing item
    const currentItems = get(items)

    for (const newItem of newItems) {
      // Get a fresh reference to the item from the current state
      const currentNewItem = currentItems.find(item => item.id === newItem.id)
      if (!currentNewItem) continue

      // Find collisions with existing items only
      const collisionsWithExisting = findCollisions(
        currentNewItem.x,
        currentNewItem.y,
        currentNewItem.w,
        currentNewItem.h,
        currentNewItem.id
      )

      if (collisionsWithExisting.size > 0) {
        resolveCollisions(collisionsWithExisting, {
          x: currentNewItem.x,
          y: currentNewItem.y,
          w: currentNewItem.w,
          h: currentNewItem.h,
          id: currentNewItem.id,
        })
      }
    }

    return newIds
  }

  // Store methods
  return {
    subscribe: items.subscribe,
    set: (newItems: AllGridTypes[]) => {
      items.set(newItems)
    },
    update: (updater: (items: AllGridTypes[]) => AllGridTypes[]) => {
      items.update(updater)
    },

    // Update item settings
    updateSettings: (settings: AllGridTypes) => {
      items.update($items =>
        $items.map(item =>
          item.id === settings.id ? { ...item, ...settings } : item
        )
      )
    },

    // Remove an item
    removeItem: (id: number) => {
      items.update($items => $items.filter(item => item.id !== id))
    },

    // Duplicate an item
    duplicateItem: duplicateItem,

    // Batch duplicate multiple items at once
    batchDuplicateItems: batchDuplicateItems,

    // Add a new item
    addItem: (item: AllGridTypes) => {
      const newPosition = findAvailablePosition(item.w, item.h, item.x, item.y)
      const newId = item.id || getNewId()

      const newItem = {
        ...item,
        id: newId,
        x: newPosition.x,
        y: newPosition.y,
      }

      items.update($items => [...$items, newItem])

      // Check if there are any collisions (should be rare since we use findAvailablePosition)
      const collisions = findCollisions(
        newPosition.x,
        newPosition.y,
        item.w,
        item.h,
        newId
      )

      if (collisions.size > 0) {
        // Resolve any unexpected collisions
        resolveCollisions(collisions, {
          x: newPosition.x,
          y: newPosition.y,
          w: item.w,
          h: item.h,
        })
      }

      return newId
    },

    // Update item position with improved collision detection
    updateItemPosition: (
      id: number,
      x: number,
      y: number,
      shouldResolveCollisions: boolean = true
    ) => {
      const currentItems = get(items)
      const item = currentItems.find(item => item.id === id)
      if (!item) return

      // Ensure valid position
      const newX = Math.max(0, Math.floor(x))
      const newY = Math.max(0, Math.floor(y))

      // If nothing changed, do nothing
      if (newX === item.x && newY === item.y) return

      // Update the item's position
      items.update($items =>
        $items.map(i => (i.id === id ? { ...i, x: newX, y: newY } : i))
      )

      // Then resolve collisions if requested
      if (shouldResolveCollisions) {
        // Find and resolve collisions
        const collisions = findCollisions(newX, newY, item.w, item.h, id)
        if (collisions.size > 0) {
          // Immediately resolve collisions - this is important for drag end
          resolveCollisions(collisions, {
            x: newX,
            y: newY,
            w: item.w,
            h: item.h,
            id,
          })
        }
      }
    },

    // Update item size with collision detection
    updateItemSize: (
      id: number,
      w: number,
      h: number,
      shouldResolveCollisions: boolean = true
    ) => {
      const currentItems = get(items)
      const item = currentItems.find(item => item.id === id)
      if (!item) return

      // Enforce minimum dimensions from both configuration and grid item's own min values
      const minWidth = Math.max(config.minWidth, item.min?.w || config.minWidth)
      const minHeight = Math.max(
        config.minHeight,
        item.min?.h || config.minHeight
      )

      const newW = Math.max(minWidth, Math.floor(w))
      const newH = Math.max(minHeight, Math.floor(h))

      // If nothing changed, do nothing
      if (newW === item.w && newH === item.h) return

      // For performance reasons, we'll do a quick check if resizing inward - no need to check collisions
      const isResizingInward = newW <= item.w && newH <= item.h

      // Update the item's size first
      items.update($items =>
        $items.map(i => (i.id === id ? { ...i, w: newW, h: newH } : i))
      )

      // Only check for collisions if we're resizing outward and collisions should be resolved
      if (shouldResolveCollisions && !isResizingInward) {
        // Find and resolve collisions
        const collisions = findCollisions(item.x, item.y, newW, newH, id)
        if (collisions.size > 0) {
          // Immediate collision resolution for resize operations
          resolveCollisions(collisions, {
            x: item.x,
            y: item.y,
            w: newW,
            h: newH,
            id,
          })
        }
      }

      return true
    },

    // Explicitly resolve position collisions after drag ends
    resolveItemPositionCollisions: (id: number) => {
      const currentItems = get(items)
      const item = currentItems.find(item => item.id === id)
      if (!item) return

      // Find and resolve any existing collisions for this item
      const collisions = findCollisions(item.x, item.y, item.w, item.h, id)
      if (collisions.size > 0) {
        // Use immediate collision resolution for drag end
        resolveCollisions(collisions, {
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          id,
        })
        return true // Return true if collisions were found and resolved
      }
      return false // Return false if no collisions were found
    },

    // Get the total grid height
    getGridHeight,
  }
}
