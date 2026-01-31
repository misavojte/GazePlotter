import type { GridItemPosition, GridConfig } from './types'
import type { AllGridTypes } from '$lib/workspace/type/gridType'

export function rectanglesOverlap(
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

export function isAreaAvailable(
  x: number,
  y: number,
  w: number,
  h: number,
  positions: GridItemPosition[],
  excludeId: number = -1
): boolean {
  if (x < 0 || y < 0) return false
  return !positions.some(
    item =>
      item.id !== excludeId &&
      rectanglesOverlap(x, y, w, h, item.x, item.y, item.w, item.h)
  )
}

export function findCollisions(
  x: number,
  y: number,
  w: number,
  h: number,
  positions: GridItemPosition[],
  excludeId: number = -1
): Set<number> {
  const collisions = new Set<number>()
  for (const item of positions) {
    if (item.id === excludeId) continue
    if (rectanglesOverlap(x, y, w, h, item.x, item.y, item.w, item.h)) {
      collisions.add(item.id)
    }
  }
  return collisions
}

export function findOptimalPosition(
  w: number,
  h: number,
  positions: GridItemPosition[],
  config: GridConfig,
  referenceItem?: GridItemPosition
): { x: number; y: number } {
  if (positions.length === 0) return { x: 0, y: 0 }

  if (referenceItem) {
    const { x: oX, y: oY, w: oW, h: oH } = referenceItem
    if (isAreaAvailable(oX + oW, oY, w, h, positions))
      return { x: oX + oW, y: oY }
    if (isAreaAvailable(oX, oY + oH, w, h, positions))
      return { x: oX, y: oY + oH }
  }

  const cellWidth = config.cellSize.width + config.gap
  const availableWidth = Math.floor(
    (typeof window !== 'undefined' ? window.innerWidth : 1920) / cellWidth
  )

  let maxX = availableWidth
  for (let i = 0; i < positions.length; i++) {
    const edge = positions[i].x + positions[i].w
    if (edge > maxX) maxX = edge
  }

  let maxY = 0
  for (let i = 0; i < positions.length; i++) {
    const edge = positions[i].y + positions[i].h
    if (edge > maxY) maxY = edge
  }

  for (let y = 0; y <= maxY; y++) {
    for (let x = 0; x <= maxX - w; x++) {
      if (isAreaAvailable(x, y, w, h, positions)) return { x, y }
    }
  }
  return { x: 0, y: maxY }
}

export function findBestConflictResolutionPosition(
  item: GridItemPosition,
  priorityItem: GridItemPosition,
  positions: GridItemPosition[],
  config: GridConfig,
  excludeId: number
): { x: number; y: number } | null {
  const { x: itemX, y: itemY, w: itemW, h: itemH } = item
  const {
    x: priorityX,
    y: priorityY,
    w: priorityW,
    h: priorityH,
  } = priorityItem

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

  const validPositions = potentialPositions.filter(
    pos =>
      pos.x >= 0 &&
      pos.y >= 0 &&
      isAreaAvailable(pos.x, pos.y, itemW, itemH, positions, excludeId)
  )

  if (validPositions.length === 0) {
    return findOptimalPosition(itemW, itemH, positions, config)
  }

  return validPositions.reduce((best, current) =>
    current.distance < best.distance ? current : best
  )
}

export function resolveItemPositionCollisions(
  priorityItemId: number,
  positions: GridItemPosition[],
  items: AllGridTypes[],
  config: GridConfig
): Array<{
  itemId: number
  settings: Partial<AllGridTypes>
}> {
  const priorityItem = positions.find(i => i.id === priorityItemId)
  if (!priorityItem) return []

  const collisions = findCollisions(
    priorityItem.x,
    priorityItem.y,
    priorityItem.w,
    priorityItem.h,
    positions,
    priorityItem.id
  )

  if (collisions.size === 0) return []

  const commands: Array<{ itemId: number; settings: Partial<AllGridTypes> }> =
    []

  for (const itemId of collisions) {
    const item = items.find(i => i.id === itemId)
    if (!item) continue

    const bestPosition = findBestConflictResolutionPosition(
      item as GridItemPosition,
      priorityItem,
      positions,
      config,
      itemId
    )

    if (
      bestPosition &&
      (bestPosition.x !== item.x || bestPosition.y !== item.y)
    ) {
      commands.push({
        itemId,
        settings: {
          x: bestPosition.x,
          y: bestPosition.y,
        } as Partial<AllGridTypes>,
      })
    }
  }

  return commands
}
