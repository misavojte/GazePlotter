/**
 * High-performance grid system for visualization workspace
 *
 * This grid system is designed specifically for the GazePlotter application
 * to provide a performant way to manage and manipulate visualization components.
 */

import type { Writable } from 'svelte/store'
import { writable, get } from 'svelte/store'

// Grid item position and dimensions
export interface GridItemPosition {
  id: number
  x: number
  y: number
  w: number
  h: number
}

// Position without ID
export type Position = Omit<GridItemPosition, 'id'>

// Grid configuration
export interface GridConfig {
  cellSize: {
    width: number
    height: number
  }
  gap: number
  minWidth: number
  minHeight: number
}

/**
 * Creates an internal grid representation for collision detection
 */
class GridMatrix {
  private matrix: Map<string, number> = new Map()

  // Generate a unique key for a cell position
  private key(x: number, y: number): string {
    return `${x},${y}`
  }

  // Mark a cell as occupied by a specific item
  occupy(x: number, y: number, id: number): void {
    // Prevent invalid values
    if (x < 0 || y < 0 || !Number.isFinite(id)) return
    this.matrix.set(this.key(x, y), id)
  }

  // Get the ID of the item occupying a cell (-1 if not occupied)
  getOccupier(x: number, y: number): number {
    // Prevent invalid values
    if (x < 0 || y < 0) return -1
    return this.matrix.get(this.key(x, y)) ?? -1
  }

  // Clear all occupied cells for a specific item
  clearItem(id: number): void {
    if (!Number.isFinite(id)) return

    // More efficient array iteration with for...of
    const keysToDelete: string[] = []
    for (const [key, value] of this.matrix.entries()) {
      if (value === id) {
        keysToDelete.push(key)
      }
    }

    // Batch delete operations
    for (const key of keysToDelete) {
      this.matrix.delete(key)
    }
  }

  // Clear the entire matrix
  clear(): void {
    this.matrix.clear()
  }

  // Mark a rectangular area as occupied by a specific item
  occupyArea(x: number, y: number, w: number, h: number, id: number): void {
    // Prevent invalid values
    if (x < 0 || y < 0 || w <= 0 || h <= 0 || !Number.isFinite(id)) return

    // Optimize for very small areas (1-2 cells)
    if (w === 1 && h === 1) {
      this.occupy(x, y, id)
      return
    }

    for (let i = 0; i < w; i++) {
      for (let j = 0; j < h; j++) {
        this.matrix.set(this.key(x + i, y + j), id)
      }
    }
  }

  // Check if a rectangular area is available (no collisions)
  isAreaAvailable(
    x: number,
    y: number,
    w: number,
    h: number,
    ignoreId: number = -1
  ): boolean {
    // Quick bounds check to avoid unnecessary iteration
    if (x < 0 || y < 0 || w <= 0 || h <= 0) return false

    // Optimize for single cell case
    if (w === 1 && h === 1) {
      const occupierId = this.getOccupier(x, y)
      return occupierId === -1 || occupierId === ignoreId
    }

    // For small areas, check each cell individually
    for (let i = 0; i < w; i++) {
      for (let j = 0; j < h; j++) {
        const occupierId = this.getOccupier(x + i, y + j)
        if (occupierId !== -1 && occupierId !== ignoreId) {
          return false
        }
      }
    }
    return true
  }

  // Find colliding items in a rectangular area
  findCollisions(
    x: number,
    y: number,
    w: number,
    h: number,
    ignoreId: number = -1
  ): Set<number> {
    const collisions = new Set<number>()

    // Quick bounds check to avoid unnecessary iteration
    if (x < 0 || y < 0 || w <= 0 || h <= 0) return collisions

    // Optimize for single cell case
    if (w === 1 && h === 1) {
      const occupierId = this.getOccupier(x, y)
      if (occupierId !== -1 && occupierId !== ignoreId) {
        collisions.add(occupierId)
      }
      return collisions
    }

    // Check all cells in the area
    for (let i = 0; i < w; i++) {
      for (let j = 0; j < h; j++) {
        const occupierId = this.getOccupier(x + i, y + j)
        if (occupierId !== -1 && occupierId !== ignoreId) {
          collisions.add(occupierId)
        }
      }
    }

    return collisions
  }
}

/**
 * Grid system manager with collision detection and item management
 */
export class GridSystem {
  private gridMatrix: GridMatrix
  private positions: Writable<GridItemPosition[]>
  private config: GridConfig
  private maxId = 0

  constructor(config: GridConfig, initialPositions: GridItemPosition[] = []) {
    this.gridMatrix = new GridMatrix()
    this.config = config
    this.positions = writable<GridItemPosition[]>([]) // Explicit typing for better intellisense

    try {
      // Validate and filter incoming positions
      const validPositions = initialPositions.filter(
        pos =>
          pos &&
          Number.isFinite(pos.id) &&
          Number.isFinite(pos.x) &&
          pos.x >= 0 &&
          Number.isFinite(pos.y) &&
          pos.y >= 0 &&
          Number.isFinite(pos.w) &&
          pos.w > 0 &&
          Number.isFinite(pos.h) &&
          pos.h > 0
      )

      // Initialize the positions store with validated data
      this.positions.set(validPositions)

      // Initialize the matrix with the provided items
      validPositions.forEach(pos => {
        this.maxId = Math.max(this.maxId, pos.id)
        this.gridMatrix.occupyArea(pos.x, pos.y, pos.w, pos.h, pos.id)
      })
    } catch (error) {
      console.error('Error initializing grid system:', error)
      // Ensure we still have a valid store if initialization fails
      this.positions.set([])
    }
  }

  /**
   * Get the positions store for binding to Svelte components
   */
  getPositionsStore(): Writable<GridItemPosition[]> {
    return this.positions
  }

  /**
   * Validate dimension inputs against minimum constraints
   * @private
   */
  private validateDimensions(
    w: number,
    h: number
  ): { width: number; height: number } {
    return {
      width: Math.max(
        this.config.minWidth,
        Math.floor(w) || this.config.minWidth
      ),
      height: Math.max(
        this.config.minHeight,
        Math.floor(h) || this.config.minHeight
      ),
    }
  }

  /**
   * Add a new item to the grid at the first available position
   */
  addItem(w: number, h: number): number {
    // Validate inputs
    const { width, height } = this.validateDimensions(w, h)

    const id = ++this.maxId
    const position = this.findFirstAvailablePosition(width, height)

    try {
      // Create the new item
      const newItem: GridItemPosition = {
        id,
        x: position.x,
        y: position.y,
        w: width,
        h: height,
      }

      // Add the new item
      this.positions.update(items => [...items, newItem])

      // Mark the grid as occupied
      this.gridMatrix.occupyArea(position.x, position.y, width, height, id)
    } catch (error) {
      console.error('Error adding grid item:', error)
    }

    return id
  }

  /**
   * Remove an item from the grid
   */
  removeItem(id: number): void {
    if (!Number.isFinite(id)) return

    try {
      this.positions.update(items => items.filter(item => item.id !== id))

      // Clear the item's occupied cells
      this.gridMatrix.clearItem(id)
    } catch (error) {
      console.error('Error removing grid item:', error)
    }
  }

  /**
   * Update an item's position with collision handling
   */
  updateItemPosition(
    id: number,
    x: number,
    y: number,
    resolveCollisions: boolean = true
  ): void {
    // Validate inputs
    if (!Number.isFinite(id) || !Number.isFinite(x) || !Number.isFinite(y)) {
      return
    }

    let newX = Math.max(0, Math.floor(x))
    let newY = Math.max(0, Math.floor(y))

    try {
      // Find the item
      const currentPositions = get(this.positions)
      const itemIndex = currentPositions.findIndex(item => item.id === id)

      if (itemIndex === -1) return

      const item = currentPositions[itemIndex]
      const oldX = item.x
      const oldY = item.y

      // If position hasn't changed, do nothing
      if (newX === oldX && newY === oldY) return

      // Clear the current item's occupied cells
      this.gridMatrix.clearItem(id)

      // Check if the new position is valid (within bounds and no collisions)
      if (resolveCollisions) {
        // Find any collisions at the new position
        const collisions = this.gridMatrix.findCollisions(
          newX,
          newY,
          item.w,
          item.h,
          id
        )

        if (collisions.size > 0) {
          try {
            // Resolve collisions by moving items down
            this.resolveCollisions(collisions, {
              x: newX,
              y: newY,
              w: item.w,
              h: item.h,
            })
          } catch (error) {
            console.error('Error resolving collisions:', error)
            // Revert to old position on error
            newX = oldX
            newY = oldY
          }
        }
      } else if (
        !this.gridMatrix.isAreaAvailable(newX, newY, item.w, item.h, id)
      ) {
        // If we're not resolving collisions and the area isn't available, revert
        newX = oldX
        newY = oldY
      }

      // Update the item's position directly - using direct update for better performance
      this.positions.update(items => {
        const updatedItems = [...items]
        updatedItems[itemIndex] = {
          ...item,
          x: newX,
          y: newY,
        }
        return updatedItems
      })

      // Re-occupy the grid with the new position
      this.gridMatrix.occupyArea(newX, newY, item.w, item.h, id)
    } catch (error) {
      console.error('Error updating item position:', error)
    }
  }

  /**
   * Update an item's size with collision handling
   */
  updateItemSize(
    id: number,
    w: number,
    h: number,
    resolveCollisions: boolean = true
  ): void {
    // Validate inputs
    if (!Number.isFinite(id) || !Number.isFinite(w) || !Number.isFinite(h)) {
      return
    }

    // Enforce minimum dimensions
    const { width: newW, height: newH } = this.validateDimensions(w, h)

    try {
      // Find the item
      const currentPositions = get(this.positions)
      const itemIndex = currentPositions.findIndex(item => item.id === id)

      if (itemIndex === -1) return

      const item = currentPositions[itemIndex]

      // If size hasn't changed, do nothing
      if (newW === item.w && newH === item.h) return

      // Clear the current item's occupied cells
      this.gridMatrix.clearItem(id)

      // Check if the new size is valid (no collisions)
      if (resolveCollisions) {
        // Find any collisions with the new size
        const collisions = this.gridMatrix.findCollisions(
          item.x,
          item.y,
          newW,
          newH,
          id
        )

        if (collisions.size > 0) {
          try {
            // Resolve collisions by moving items down
            this.resolveCollisions(collisions, {
              x: item.x,
              y: item.y,
              w: newW,
              h: newH,
            })
          } catch (error) {
            console.error('Error resolving collisions:', error)
            // Re-occupy the grid with the original size
            this.gridMatrix.occupyArea(item.x, item.y, item.w, item.h, id)
            return
          }
        }
      } else if (
        !this.gridMatrix.isAreaAvailable(item.x, item.y, newW, newH, id)
      ) {
        // If we're not resolving collisions and the area isn't available, revert
        this.gridMatrix.occupyArea(item.x, item.y, item.w, item.h, id)
        return
      }

      // Update the item's size directly - using direct update for better performance
      this.positions.update(items => {
        const updatedItems = [...items]
        updatedItems[itemIndex] = {
          ...item,
          w: newW,
          h: newH,
        }
        return updatedItems
      })

      // Re-occupy the grid with the new size
      this.gridMatrix.occupyArea(item.x, item.y, newW, newH, id)
    } catch (error) {
      console.error('Error updating item size:', error)
    }
  }

  /**
   * Find the first available position for a new item
   */
  findFirstAvailablePosition(w: number, h: number): Position {
    // Validate inputs
    const { width, height } = this.validateDimensions(w, h)

    try {
      const currentPositions = get(this.positions)

      // If no items exist, start at the top-left
      if (currentPositions.length === 0) {
        return { x: 0, y: 0, w: width, h: height }
      }

      // Find the max Y position to start placing below existing items
      let maxY = 0
      for (const item of currentPositions) {
        maxY = Math.max(maxY, item.y + item.h)
      }

      // First try to find space at the same vertical level
      for (let x = 0; x < 100; x++) {
        // Limit horizontal search to 100 columns
        for (let y = 0; y < maxY; y++) {
          if (this.gridMatrix.isAreaAvailable(x, y, width, height)) {
            return { x, y, w: width, h: height }
          }
        }
      }

      // If we can't fit it at the current level, place it below
      return { x: 0, y: maxY, w: width, h: height }
    } catch (error) {
      console.error('Error finding available position:', error)
      return { x: 0, y: 0, w: width, h: height }
    }
  }

  /**
   * Get the total height of the grid based on item positions
   */
  getGridHeight(): number {
    try {
      const currentPositions = get(this.positions)
      let maxY = 0

      // Calculate the maximum Y position + height for all items
      for (const item of currentPositions) {
        // Ensure we're accounting for the bottom edge of each item
        const itemBottom = item.y + item.h
        maxY = Math.max(maxY, itemBottom)
      }

      // Convert grid units to pixel height, adding extra padding at the bottom
      return Math.max(
        200, // Minimum height
        maxY * (this.config.cellSize.height + this.config.gap) +
          this.config.gap +
          40 // Add extra padding
      )
    } catch (error) {
      console.error('Error calculating grid height:', error)
      return 200 // Fallback minimum height
    }
  }

  /**
   * Simple collision resolution by moving items downward
   */
  private resolveCollisions(
    collisions: Set<number>,
    newItem: { x: number; y: number; w: number; h: number }
  ): void {
    const currentPositions = get(this.positions)

    // Find all colliding items upfront to avoid multiple Array.filter operations
    const collidingItems: GridItemPosition[] = []
    for (const item of currentPositions) {
      if (collisions.has(item.id)) {
        collidingItems.push(item)
      }
    }

    if (collidingItems.length === 0) return

    // Move colliding items downward
    const bottomEdge = newItem.y + newItem.h

    // Process all colliding items at once
    this.positions.update(items => {
      // Make a single copy of the array for all updates
      const updatedItems = [...items]

      for (const item of collidingItems) {
        // First clear the item from the grid matrix
        this.gridMatrix.clearItem(item.id)

        // Find index in the array
        const index = updatedItems.findIndex(i => i.id === item.id)
        if (index !== -1) {
          // Update the position directly
          updatedItems[index] = {
            ...updatedItems[index],
            y: bottomEdge,
          }

          // Reoccupy the grid matrix
          this.gridMatrix.occupyArea(
            item.x,
            bottomEdge,
            item.w,
            item.h,
            item.id
          )
        }
      }

      return updatedItems
    })
  }

  /**
   * Manually occupy space for a new item before adding it to the positions store
   * This is useful for ensuring the grid matrix is updated immediately, preventing stacked items
   */
  occupyItem(id: number, x: number, y: number, w: number, h: number): void {
    if (
      !Number.isFinite(id) ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(w) ||
      !Number.isFinite(h)
    ) {
      return
    }

    // Ensure item has minimum dimensions
    const { width, height } = this.validateDimensions(w, h)

    // Explicitly occupy the grid matrix for this item
    this.gridMatrix.occupyArea(x, y, width, height, id)
  }

  /**
   * Find a good position for a duplicated item, following these rules:
   * 1. Try to place it to the right of the original item
   * 2. If no space there, try below the original item
   * 3. Continue looking for empty spaces following this pattern
   */
  findDuplicationPosition(
    originalX: number,
    originalY: number,
    width: number,
    height: number,
    maxGridWidth: number = 100
  ): Position {
    try {
      // Validate inputs
      const { width: w, height: h } = this.validateDimensions(width, height)

      // First try: to the right of original (using grid units)
      const rightX = originalX + w // use w for width in grid units

      // Make sure it doesn't go off-screen (allow at least 25% visibility)
      const maxAllowedX = maxGridWidth - Math.ceil(w * 0.25)

      // Double-check isAreaAvailable to avoid stacking during rapid duplications
      if (
        rightX <= maxAllowedX &&
        this.gridMatrix.isAreaAvailable(rightX, originalY, w, h)
      ) {
        // Do a final collision check to be absolutely sure
        const collisions = this.gridMatrix.findCollisions(
          rightX,
          originalY,
          w,
          h
        )
        if (collisions.size === 0) {
          return { x: rightX, y: originalY, w, h }
        }
      }

      // Second try: below the original (using grid units)
      const belowY = originalY + h // use h for height in grid units

      // Double-check isAreaAvailable to avoid stacking
      if (this.gridMatrix.isAreaAvailable(originalX, belowY, w, h)) {
        // Do a final collision check
        const collisions = this.gridMatrix.findCollisions(
          originalX,
          belowY,
          w,
          h
        )
        if (collisions.size === 0) {
          return { x: originalX, y: belowY, w, h }
        }
      }

      // Third try: below and to the left (back to x=0)
      if (originalX > 0 && this.gridMatrix.isAreaAvailable(0, belowY, w, h)) {
        // Do a final collision check
        const collisions = this.gridMatrix.findCollisions(0, belowY, w, h)
        if (collisions.size === 0) {
          return { x: 0, y: belowY, w, h }
        }
      }

      // Fourth try: below and scan right for any available spot
      for (let x = 0; x <= maxAllowedX; x++) {
        if (this.gridMatrix.isAreaAvailable(x, belowY, w, h)) {
          // Do a final collision check
          const collisions = this.gridMatrix.findCollisions(x, belowY, w, h)
          if (collisions.size === 0) {
            return { x, y: belowY, w, h }
          }
        }
      }

      // Keep moving down and scanning the entire row until we find space
      let currentY = belowY
      const maxIterations = 100 // Safety limit
      let iterations = 0

      while (iterations < maxIterations) {
        iterations++
        currentY++

        for (let x = 0; x <= maxAllowedX; x++) {
          if (this.gridMatrix.isAreaAvailable(x, currentY, w, h)) {
            // Do a final collision check
            const collisions = this.gridMatrix.findCollisions(x, currentY, w, h)
            if (collisions.size === 0) {
              return { x, y: currentY, w, h }
            }
          }
        }
      }

      // Fallback: use the regular method
      return this.findFirstAvailablePosition(w, h)
    } catch (error) {
      console.error('Error finding duplication position:', error)
      return this.findFirstAvailablePosition(width, height)
    }
  }
}

/**
 * Create a grid system store with the given config and initial positions
 */
export function createGridSystem(
  config: GridConfig,
  initialPositions: GridItemPosition[] = []
): {
  system: GridSystem
  positions: Writable<GridItemPosition[]>
} {
  try {
    const system = new GridSystem(config, initialPositions)
    const positions = system.getPositionsStore()

    return {
      system,
      positions,
    }
  } catch (error) {
    console.error('Error creating grid system:', error)
    // Fallback to an empty system
    const fallbackSystem = new GridSystem(config, [])
    return {
      system: fallbackSystem,
      positions: fallbackSystem.getPositionsStore(),
    }
  }
}
