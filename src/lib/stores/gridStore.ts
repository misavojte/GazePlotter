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

  // Check if an area is available (no collisions)
  function isAreaAvailable(
    x: number,
    y: number,
    w: number,
    h: number,
    excludeId: number = -1
  ) {
    if (x < 0 || y < 0) return false

    // Use the unified collision detection with returnBoolean flag
    return !detectCollisions(x, y, w, h, {
      excludeIds: excludeId,
      returnBoolean: true,
    })
  }

  // Unified collision detection function that supports multiple approaches
  function detectCollisions(
    x: number,
    y: number,
    w: number,
    h: number,
    options: {
      excludeIds?: Set<number> | number
      itemsToCheck?: any[]
      returnSet?: boolean
      returnBoolean?: boolean
    } = {}
  ) {
    const {
      excludeIds = -1,
      itemsToCheck,
      returnSet = true,
      returnBoolean = false,
    } = options

    // Process excludeIds to handle both number and Set cases
    const excludeIdSet =
      typeof excludeIds === 'number'
        ? excludeIds >= 0
          ? new Set([excludeIds])
          : new Set<number>()
        : excludeIds

    // Determine which items to check for collisions
    const itemsToProcess = itemsToCheck || get(positions)

    const collisionIds = new Set<number>()

    for (const item of itemsToProcess) {
      // Skip excluded items
      if (excludeIdSet.has(item.id)) continue

      // Optimized rectangle intersection test
      if (
        x < item.x + item.w &&
        x + w > item.x &&
        y < item.y + item.h &&
        y + h > item.y
      ) {
        if (returnBoolean) {
          return true // Early return if we only need to know if ANY collision exists
        }

        if (returnSet) {
          collisionIds.add(item.id)
        }
      }
    }

    return returnBoolean ? false : collisionIds
  }

  // Helper functions that use the main collision detection function
  const findCollisions = (
    x: number,
    y: number,
    w: number,
    h: number,
    excludeId: number = -1
  ) => {
    return detectCollisions(x, y, w, h, {
      excludeIds: excludeId,
      returnSet: true,
    }) as Set<number>
  }

  const positionCausesCollisions = (
    x: number,
    y: number,
    w: number,
    h: number,
    itemsToCheck: any[],
    excludeIds: Set<number>
  ): boolean => {
    return detectCollisions(x, y, w, h, {
      excludeIds,
      itemsToCheck,
      returnBoolean: true,
    }) as boolean
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

  // New unified function for intelligent grid conflict resolution
  // This handles all types of grid operations (add, move, resize, duplicate)
  function resolveGridConflicts(priorityItem: {
    id: number
    x: number
    y: number
    w: number
    h: number
    operation: 'move' | 'resize' | 'add' | 'duplicate'
  }) {
    // Step 1: Find all items that collide with our priority item
    const primaryCollisions = findCollisions(
      priorityItem.x,
      priorityItem.y,
      priorityItem.w,
      priorityItem.h,
      priorityItem.id
    )

    if (primaryCollisions.size === 0) return false // No conflicts to resolve

    // Step 2: Create a working copy of all items for manipulation
    const currentItems = get(items)
    let workingItems = [...currentItems]

    // Get the priority item from working items (for current state)
    const currentPriorityItem = workingItems.find(
      item => item.id === priorityItem.id
    )

    if (!currentPriorityItem) return false // Priority item not found

    // Step 3: Create a list of items to reposition, ordered by best candidates first
    const itemsToReposition = workingItems
      .filter(item => primaryCollisions.has(item.id))
      .sort((a, b) => {
        // Sorting criteria to determine which items to move:

        // 1. Prefer moving items with less overlap area (lighter collision)
        const overlapA = calculateOverlapArea(currentPriorityItem, a)
        const overlapB = calculateOverlapArea(currentPriorityItem, b)
        if (overlapA !== overlapB) return overlapA - overlapB

        // 2. Prefer moving smaller items
        const areaA = a.w * a.h
        const areaB = b.w * b.h
        if (areaA !== areaB) return areaA - areaB

        // 3. Prefer moving items below rather than above
        const aBelow = a.y >= currentPriorityItem.y + currentPriorityItem.h
        const bBelow = b.y >= currentPriorityItem.y + currentPriorityItem.h
        if (aBelow !== bBelow) return aBelow ? -1 : 1

        // 4. If all else equal, prefer moving by proximity to bottom edge
        return (
          Math.abs(a.y - (currentPriorityItem.y + currentPriorityItem.h)) -
          Math.abs(b.y - (currentPriorityItem.y + currentPriorityItem.h))
        )
      })

    // Step 4: Process each item that needs repositioning
    for (const itemToMove of itemsToReposition) {
      // Determine best strategy for this item
      let bestPosition: { x: number; y: number } | null = null

      // Strategy 1: Try to move below the priority item (most common case)
      bestPosition = {
        x: itemToMove.x,
        y: currentPriorityItem.y + currentPriorityItem.h,
      }

      // Check if this position causes secondary collisions
      const positionCauses = positionCausesCollisions(
        bestPosition.x,
        bestPosition.y,
        itemToMove.w,
        itemToMove.h,
        workingItems,
        new Set([itemToMove.id, priorityItem.id])
      )

      // If position has collisions, find alternatives
      if (positionCauses) {
        // Strategy 2: Find the lowest Y position that doesn't cause collisions
        // Start from bottom of priority item and scan downward
        const lowestY = findLowestAvailableY(
          itemToMove.x,
          currentPriorityItem.y + currentPriorityItem.h,
          itemToMove.w,
          itemToMove.h,
          workingItems,
          new Set([itemToMove.id, priorityItem.id])
        )

        if (lowestY !== null) {
          bestPosition = { x: itemToMove.x, y: lowestY }
        } else {
          // Strategy 3: Try an alternative X position if vertical stacking doesn't work
          // Check to the right of the priority item
          const rightX = currentPriorityItem.x + currentPriorityItem.w
          if (
            !positionCausesCollisions(
              rightX,
              itemToMove.y,
              itemToMove.w,
              itemToMove.h,
              workingItems,
              new Set([itemToMove.id, priorityItem.id])
            )
          ) {
            bestPosition = { x: rightX, y: itemToMove.y }
          } else {
            // Strategy 4: Last resort - find any available position using the grid scanner
            bestPosition = findOptimalPosition(itemToMove.w, itemToMove.h, {
              preferredX: itemToMove.x,
              preferredY: itemToMove.y,
              strategy: 'new',
            })
          }
        }
      }

      // Apply the best position to our working copy
      workingItems = workingItems.map(item =>
        item.id === itemToMove.id
          ? { ...item, x: bestPosition!.x, y: bestPosition!.y }
          : item
      )
    }

    // Step 5: Apply all changes at once to avoid multiple reflows
    items.update($items => {
      return $items.map(item => {
        // Find corresponding item in working copy
        const updatedItem = workingItems.find(w => w.id === item.id)
        if (!updatedItem) return item

        // If this is a collision item that was moved, return updated position
        if (primaryCollisions.has(item.id)) {
          return { ...item, x: updatedItem.x, y: updatedItem.y }
        }

        // Otherwise return the unchanged item
        return item
      })
    })

    return true // Conflicts were found and resolved
  }

  // Helper function to calculate overlap area between two grid items
  function calculateOverlapArea(item1: any, item2: any): number {
    // Calculate the intersection
    const xOverlap = Math.max(
      0,
      Math.min(item1.x + item1.w, item2.x + item2.w) -
        Math.max(item1.x, item2.x)
    )
    const yOverlap = Math.max(
      0,
      Math.min(item1.y + item1.h, item2.y + item2.h) -
        Math.max(item1.y, item2.y)
    )

    // Return the area of overlap
    return xOverlap * yOverlap
  }

  // Helper function to find the lowest available Y position
  function findLowestAvailableY(
    x: number,
    startY: number,
    w: number,
    h: number,
    itemsToCheck: any[],
    excludeIds: Set<number>
  ): number | null {
    // Get all items sorted by their Y position
    const sortedItems = [...itemsToCheck]
      .filter(item => !excludeIds.has(item.id))
      .sort((a, b) => a.y - b.y)

    if (sortedItems.length === 0) return startY

    // Check if the starting position works
    if (!positionCausesCollisions(x, startY, w, h, sortedItems, excludeIds)) {
      return startY
    }

    // Find each potential Y position (bottom edge of each item)
    const potentialYPositions = sortedItems
      .map(item => item.y + item.h)
      .filter(y => y > startY)
      .sort((a, b) => a - b)

    // Try each position from top to bottom
    for (const y of potentialYPositions) {
      if (!positionCausesCollisions(x, y, w, h, sortedItems, excludeIds)) {
        return y
      }
    }

    // If all positions cause collisions, try one position below the last item
    const maxY = Math.max(...itemsToCheck.map(item => item.y + item.h))
    return maxY
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

  // Unified position finder that handles multiple scenarios
  function findOptimalPosition(
    w: number,
    h: number,
    options: {
      preferredX?: number
      preferredY?: number
      referenceItem?: { x: number; y: number; w: number; h: number }
      strategy?: 'duplicate' | 'new' | 'bottom' | 'right'
      excludeIds?: Set<number>
      maxGridWidth?: number
    } = {}
  ) {
    const {
      preferredX,
      preferredY,
      referenceItem,
      strategy = 'new',
      excludeIds = new Set<number>(),
      maxGridWidth = 30, // Reduced default max width to prevent overstretching
    } = options

    const currentItems = get(items)

    // Ensure minimum dimensions
    const width = Math.max(config.minWidth, w || config.minWidth)
    const height = Math.max(config.minHeight, h || config.minHeight)

    // If no items exist or preferred position is explicitly provided and available
    if (
      currentItems.length === 0 ||
      (preferredX !== undefined &&
        preferredY !== undefined &&
        isAreaAvailable(preferredX, preferredY, width, height))
    ) {
      return { x: preferredX ?? 0, y: preferredY ?? 0 }
    }

    // --- UNIFIED POSITIONING STRATEGY ---
    // First, try specific positions based on strategy

    // Option 1: For duplicates, try specific relative positions first
    if (strategy === 'duplicate' && referenceItem) {
      const originalX = referenceItem.x
      const originalY = referenceItem.y

      // Limit horizontal expansion to prevent overstretching
      const rightX = originalX + referenceItem.w
      const canPlaceRight = rightX < maxGridWidth

      // Try positions in a prioritized order
      const positionsToTry = [
        // Right of original (if within bounds)
        ...(canPlaceRight ? [{ x: rightX, y: originalY }] : []),
        // Below original (our preferred fallback)
        { x: originalX, y: originalY + referenceItem.h },
        // Left-aligned below (if original is not at origin)
        ...(originalX > 0 ? [{ x: 0, y: originalY + referenceItem.h }] : []),
      ]

      for (const pos of positionsToTry) {
        if (isAreaAvailable(pos.x, pos.y, width, height)) {
          return pos
        }
      }
    }

    // Option 2: Find first available position through systematic scanning
    // This approach works for both new items and as a fallback for duplicates

    // Calculate the currently occupied grid bounds
    let maxOccupiedX = 0
    let maxOccupiedY = 0

    if (currentItems.length > 0) {
      maxOccupiedX = Math.max(...currentItems.map(item => item.x + item.w))
      maxOccupiedY = Math.max(...currentItems.map(item => item.y + item.h))
    }

    // First pass: scan row by row within currently occupied space
    // This helps fill gaps in the existing layout
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

    // Second pass: try placing at the bottom of the current layout
    // This is good for adding new rows without stretching too far horizontally
    for (let scanX = 0; scanX < Math.min(10, maxGridWidth); scanX++) {
      if (isAreaAvailable(scanX, maxOccupiedY, width, height)) {
        return { x: scanX, y: maxOccupiedY }
      }
    }

    // Third pass: careful expansion in both dimensions
    // We prioritize vertical expansion over horizontal when maxWidth is approached
    for (let scanY = 0; scanY < maxOccupiedY + 10; scanY++) {
      // Limit horizontal scanning based on remaining space
      const horizontalLimit =
        scanY <= maxOccupiedY
          ? maxGridWidth // Full width for existing rows
          : Math.min(15, maxGridWidth) // Limited width for new rows

      for (let scanX = 0; scanX < horizontalLimit; scanX++) {
        if (isAreaAvailable(scanX, scanY, width, height)) {
          return { x: scanX, y: scanY }
        }
      }
    }

    // If all else fails, place at the bottom left
    return { x: 0, y: maxOccupiedY + 1 }
  }

  // Helper functions that use the main position finder with specific strategies
  const findAvailablePosition = (
    w: number,
    h: number,
    preferredX?: number,
    preferredY?: number
  ) => {
    return findOptimalPosition(w, h, {
      preferredX,
      preferredY,
      strategy: 'new',
    })
  }

  const findDuplicationPosition = (
    originalX: number,
    originalY: number,
    w: number,
    h: number
  ) => {
    return findOptimalPosition(w, h, {
      referenceItem: { x: originalX, y: originalY, w, h },
      strategy: 'duplicate',
    })
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

    // Use the new unified system for conflict resolution
    resolveGridConflicts({
      id: newId,
      x: newPosition.x,
      y: newPosition.y,
      w: item.w,
      h: item.h,
      operation: 'duplicate',
    })

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

    // Use the unified conflict resolution for each new item
    const currentItems = get(items)

    // Process in reverse order so that earlier items (generally more important)
    // maintain their positions better
    for (let i = newItems.length - 1; i >= 0; i--) {
      const newItem = newItems[i]

      // Get a fresh reference to the item from the current state
      const currentNewItem = currentItems.find(item => item.id === newItem.id)
      if (!currentNewItem) continue

      // Resolve conflicts for this item
      resolveGridConflicts({
        id: currentNewItem.id,
        x: currentNewItem.x,
        y: currentNewItem.y,
        w: currentNewItem.w,
        h: currentNewItem.h,
        operation: 'duplicate',
      })
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

      // Use unified conflict resolution
      resolveGridConflicts({
        id: newId,
        x: newPosition.x,
        y: newPosition.y,
        w: item.w,
        h: item.h,
        operation: 'add',
      })

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
        // Use the new unified conflict resolution system
        resolveGridConflicts({
          id,
          x: newX,
          y: newY,
          w: item.w,
          h: item.h,
          operation: 'move',
        })
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
        // Use the new unified conflict resolution system
        resolveGridConflicts({
          id,
          x: item.x,
          y: item.y,
          w: newW,
          h: newH,
          operation: 'resize',
        })
      }

      return true
    },

    // Explicitly resolve position collisions after drag ends
    resolveItemPositionCollisions: (id: number) => {
      const currentItems = get(items)
      const item = currentItems.find(item => item.id === id)
      if (!item) return

      // Use the new unified conflict resolution system
      return resolveGridConflicts({
        id,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        operation: 'move',
      })
    },

    // Get the total grid height
    getGridHeight,
  }
}
