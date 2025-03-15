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
    excludeId: number = -1
  ) {
    const map = new Map<string, number>()

    for (const item of gridItems) {
      if (item.id === excludeId) continue

      for (let x = item.x; x < item.x + item.w; x++) {
        for (let y = item.y; y < item.y + item.h; y++) {
          map.set(`${x},${y}`, item.id)
        }
      }
    }

    return map
  }

  // Check if an area is available (no collisions)
  function isAreaAvailable(
    x: number,
    y: number,
    w: number,
    h: number,
    excludeId: number = -1
  ) {
    const currentPositions = get(positions)
    const occupancyMap = createOccupancyMap(currentPositions, excludeId)

    if (x < 0 || y < 0) return false

    for (let i = 0; i < w; i++) {
      for (let j = 0; j < h; j++) {
        if (occupancyMap.has(`${x + i},${y + j}`)) {
          return false
        }
      }
    }

    return true
  }

  // Find collisions for a given area
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

      // Check for rectangle intersection
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

  // Resolve collisions by moving items down
  function resolveCollisions(
    collisionSet: Set<number>,
    newItem: { x: number; y: number; w: number; h: number }
  ) {
    if (collisionSet.size === 0) return

    const bottomEdge = newItem.y + newItem.h

    items.update($items => {
      return $items.map(item => {
        if (collisionSet.has(item.id)) {
          return { ...item, y: bottomEdge }
        }
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

  // Find smart position for a new item
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

    // Try to find space at current levels
    for (let scanY = 0; scanY <= maxY; scanY++) {
      for (let scanX = 0; scanX < 100; scanX++) {
        if (isAreaAvailable(scanX, scanY, width, height)) {
          return { x: scanX, y: scanY }
        }
      }
    }

    // If we can't fit it at current levels, place it below
    return { x: 0, y: maxY }
  }

  // Find position for duplicated item
  function findDuplicationPosition(
    originalX: number,
    originalY: number,
    w: number,
    h: number,
    maxGridWidth: number = 100
  ) {
    // Try right of original
    const rightX = originalX + w
    const maxAllowedX = maxGridWidth - Math.ceil(w * 0.25)

    if (rightX <= maxAllowedX && isAreaAvailable(rightX, originalY, w, h)) {
      return { x: rightX, y: originalY }
    }

    // Try below original
    const belowY = originalY + h
    if (isAreaAvailable(originalX, belowY, w, h)) {
      return { x: originalX, y: belowY }
    }

    // Try below and left
    if (originalX > 0 && isAreaAvailable(0, belowY, w, h)) {
      return { x: 0, y: belowY }
    }

    // Scan for any available spot
    return findAvailablePosition(w, h)
  }

  // Store methods
  return {
    subscribe: items.subscribe,
    set: items.set,
    update: items.update,

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
    duplicateItem: (item: AllGridTypes) => {
      const newId = getNewId()
      const newPosition = findDuplicationPosition(
        item.x,
        item.y,
        item.w,
        item.h
      )

      items.update($items => [
        ...$items,
        {
          ...item,
          id: newId,
          x: newPosition.x,
          y: newPosition.y,
        },
      ])

      return newId
    },

    // Add a new item
    addItem: (item: AllGridTypes) => {
      const newPosition = findAvailablePosition(item.w, item.h, item.x, item.y)

      const newId = item.id || getNewId()

      items.update($items => [
        ...$items,
        {
          ...item,
          id: newId,
          x: newPosition.x,
          y: newPosition.y,
        },
      ])

      return newId
    },

    // Update item position with collision detection
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
          resolveCollisions(collisions, {
            x: newX,
            y: newY,
            w: item.w,
            h: item.h,
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

      // Enforce minimum dimensions
      const newW = Math.max(config.minWidth, w)
      const newH = Math.max(config.minHeight, h)

      // If nothing changed, do nothing
      if (newW === item.w && newH === item.h) return

      // Update the item's size
      items.update($items =>
        $items.map(i => (i.id === id ? { ...i, w: newW, h: newH } : i))
      )

      // Then resolve collisions if requested
      if (shouldResolveCollisions) {
        // Find and resolve collisions
        const collisions = findCollisions(item.x, item.y, newW, newH, id)
        if (collisions.size > 0) {
          resolveCollisions(collisions, {
            x: item.x,
            y: item.y,
            w: newW,
            h: newH,
          })
        }
      }
    },

    // Resolve position collisions after drag ends
    resolveItemPositionCollisions: (id: number) => {
      const currentItems = get(items)
      const item = currentItems.find(item => item.id === id)
      if (!item) return

      const collisions = findCollisions(item.x, item.y, item.w, item.h, id)
      if (collisions.size > 0) {
        resolveCollisions(collisions, {
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
        })
      }
    },

    // Get the total grid height
    getGridHeight,
  }
}
