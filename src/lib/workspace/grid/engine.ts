import type { GridItemPosition } from './types'
import type { AllGridTypes, GridItemLayoutUpdate } from '$lib/workspace'

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

function findCollisions(
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
  availableColumns: number,
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

  let maxX = availableColumns
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

type ResolutionCommand = {
  itemId: number
  settings: GridItemLayoutUpdate
}

type ResolutionPlan = {
  updates: ResolutionCommand[]
  cost: number
}

type Direction = 'R' | 'L' | 'D' | 'U'
// Tried in this order. Equal-cost chains tiebreak on which direction
// tried first → horizontal pushes (R, L) beat vertical (D, U), which
// keeps row-arranged items on the same row when the grid gets shoved.
const DIRECTIONS: Direction[] = ['R', 'L', 'D', 'U']

// Recursively compute the set of moves needed to push `itemId` in
// `direction` until it clears `clearFrom`. Any item already in the way
// is pushed by the same rule (clear from the item we pushed through).
// Returns null if the chain dead-ends (grid edge / hits priority / loops).
function cascadeInDirection(
  itemId: number,
  direction: Direction,
  clearFrom: GridItemPosition,
  sim: Map<number, GridItemPosition>,
  priorityId: number,
  visited: Set<number>
): Map<number, { x: number; y: number }> | null {
  if (itemId === priorityId) return null
  if (visited.has(itemId)) return null
  visited.add(itemId)

  const item = sim.get(itemId)
  if (!item) return null

  let newX = item.x
  let newY = item.y
  if (direction === 'R') newX = clearFrom.x + clearFrom.w
  else if (direction === 'L') newX = clearFrom.x - item.w
  else if (direction === 'D') newY = clearFrom.y + clearFrom.h
  else newY = clearFrom.y - item.h

  if (newX < 0 || newY < 0) return null

  const simArray = Array.from(sim.values())
  const collisions = findCollisions(
    newX,
    newY,
    item.w,
    item.h,
    simArray,
    itemId
  )
  if (collisions.has(priorityId)) return null

  const result = new Map<number, { x: number; y: number }>()
  result.set(itemId, { x: newX, y: newY })

  const myNewRect: GridItemPosition = {
    id: itemId,
    x: newX,
    y: newY,
    w: item.w,
    h: item.h,
  }
  for (const cid of collisions) {
    if (visited.has(cid)) continue
    const subPlan = cascadeInDirection(
      cid,
      direction,
      myNewRect,
      sim,
      priorityId,
      visited
    )
    if (subPlan === null) return null
    for (const [k, v] of subPlan) result.set(k, v)
  }

  return result
}

// Directional-push strategy. For each direct collider, try pushing it
// (and any items in its way) in each of 4 cardinal directions; apply
// the cheapest chain to the sim before moving on to the next direct
// collider. Falls back to findOptimalPosition for any collider that
// can't be pushed anywhere (all directions blocked by grid edges or
// priority).
function runCascadeResolution(
  priority: GridItemPosition,
  initialColliders: Iterable<number>,
  positions: GridItemPosition[],
  availableColumns: number
): ResolutionPlan {
  const original = new Map(positions.map(p => [p.id, p]))
  const sim = new Map(positions.map(p => [p.id, { ...p }]))
  const moved = new Set<number>()

  for (const id of initialColliders) {
    if (id === priority.id) continue
    const current = sim.get(id)
    if (!current) continue

    let best:
      | { chain: Map<number, { x: number; y: number }>; cost: number }
      | null = null

    for (const dir of DIRECTIONS) {
      const chain = cascadeInDirection(
        id,
        dir,
        priority,
        sim,
        priority.id,
        new Set<number>()
      )
      if (chain === null) continue
      let cost = 0
      for (const [pid, newPos] of chain) {
        const prev = sim.get(pid)
        if (!prev) continue
        cost += Math.abs(newPos.x - prev.x) + Math.abs(newPos.y - prev.y)
      }
      if (!best || cost < best.cost) best = { chain, cost }
    }

    if (best) {
      for (const [pid, newPos] of best.chain) {
        const prev = sim.get(pid)
        if (!prev) continue
        sim.set(pid, { ...prev, x: newPos.x, y: newPos.y })
        moved.add(pid)
      }
      continue
    }

    // No direction works — fall back to first-free cell.
    const simArray = Array.from(sim.values()).filter(p => p.id !== id)
    const next = findOptimalPosition(
      current.w,
      current.h,
      simArray,
      availableColumns
    )
    if (next.x !== current.x || next.y !== current.y) {
      sim.set(id, { ...current, x: next.x, y: next.y })
      moved.add(id)
    }
  }

  const updates: ResolutionCommand[] = []
  let cost = 0
  for (const id of moved) {
    const orig = original.get(id)
    const final = sim.get(id)
    if (!orig || !final) continue
    if (final.x === orig.x && final.y === orig.y) continue
    updates.push({ itemId: id, settings: { x: final.x, y: final.y } })
    cost += Math.abs(final.x - orig.x) + Math.abs(final.y - orig.y)
  }
  return { updates, cost }
}

// Each direct collider is relocated to the first free cell via
// findOptimalPosition — no cascade. Cheaper than cascade when pushing
// locally would ripple through many items.
function runRelocateResolution(
  priority: GridItemPosition,
  directColliders: Iterable<number>,
  positions: GridItemPosition[],
  availableColumns: number
): ResolutionPlan {
  const original = new Map(positions.map(p => [p.id, p]))
  const sim = new Map(positions.map(p => [p.id, { ...p }]))
  const updates: ResolutionCommand[] = []
  let cost = 0

  for (const id of directColliders) {
    if (id === priority.id) continue
    const current = sim.get(id)
    if (!current) continue
    const simArray = Array.from(sim.values()).filter(p => p.id !== id)
    const next = findOptimalPosition(
      current.w,
      current.h,
      simArray,
      availableColumns
    )
    if (next.x === current.x && next.y === current.y) continue
    sim.set(id, { ...current, x: next.x, y: next.y })
    const orig = original.get(id)
    if (!orig) continue
    updates.push({ itemId: id, settings: { x: next.x, y: next.y } })
    cost += Math.abs(next.x - orig.x) + Math.abs(next.y - orig.y)
  }

  return { updates, cost }
}

// Resolves collisions introduced by a move/resize/add of `priorityItemId`.
// Runs two strategies — a BFS cascade and a bulk relocate — then returns
// whichever has the lower total Manhattan displacement. Ties go to the
// cascade, which keeps moved items local to the user's action.
export function resolveItemPositionCollisions(
  priorityItemId: number,
  positions: GridItemPosition[],
  _items: AllGridTypes[],
  availableColumns: number
): Array<{
  itemId: number
  settings: GridItemLayoutUpdate
}> {
  const priorityItem = positions.find(i => i.id === priorityItemId)
  if (!priorityItem) return []

  const directColliders = findCollisions(
    priorityItem.x,
    priorityItem.y,
    priorityItem.w,
    priorityItem.h,
    positions,
    priorityItem.id
  )

  if (directColliders.size === 0) return []

  const cascade = runCascadeResolution(
    priorityItem,
    directColliders,
    positions,
    availableColumns
  )
  const relocate = runRelocateResolution(
    priorityItem,
    directColliders,
    positions,
    availableColumns
  )

  return cascade.cost <= relocate.cost ? cascade.updates : relocate.updates
}
