import {
  gridToPixelDimensions,
  gridToPixelPosition,
  type PixelBounds,
  type PixelConfig,
} from './pixels'
import type { GridItemPosition } from './types'

type ItemRect = Omit<GridItemPosition, 'id'>

interface Point {
  x: number
  y: number
}

interface Segment {
  id: number
  p1: Point
  p2: Point
}

/**
 * Subtracts interval [u, v] from a list of intervals.
 */
function subtractInterval(
  intervals: Array<[number, number]>,
  u: number,
  v: number
): Array<[number, number]> {
  const result: Array<[number, number]> = []
  for (const [s, e] of intervals) {
    if (e <= u || s >= v) {
      // No overlap
      result.push([s, e])
    } else {
      // Overlap
      if (s < u) {
        result.push([s, u])
      }
      if (e > v) {
        result.push([v, e])
      }
    }
  }
  return result
}

/**
 * Merges overlapping and touching collinear segments.
 */
function mergeIntervals(
  intervals: Array<[number, number]>
): Array<[number, number]> {
  if (intervals.length === 0) return []
  // Sort by start coordinate
  const sorted = [...intervals].sort((a, b) => a[0] - b[0])
  const merged: Array<[number, number]> = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1]
    const curr = sorted[i]
    if (curr[0] <= last[1]) {
      last[1] = Math.max(last[1], curr[1])
    } else {
      merged.push(curr)
    }
  }
  return merged
}

interface CollinearInput {
  coord: number
  rangeStart: number
  rangeEnd: number
}

/**
 * Groups segments by coordinate key and merges them collinear-ly.
 */
function groupAndMergeCollinear(segments: CollinearInput[]): CollinearInput[] {
  const groups = new Map<number, Array<[number, number]>>()
  for (const seg of segments) {
    const key = Math.round(seg.coord * 100) / 100
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push([seg.rangeStart, seg.rangeEnd])
  }

  const result: CollinearInput[] = []
  for (const [coord, intervals] of groups) {
    const merged = mergeIntervals(intervals)
    for (const [rangeStart, rangeEnd] of merged) {
      result.push({ coord, rangeStart: rangeStart, rangeEnd: rangeEnd })
    }
  }
  return result
}

/**
 * Calculates rounded corner points P1 and P2 for corner B with adjacent vertices A and C.
 */
function getCornerPoints(
  A: Point,
  B: Point,
  C: Point,
  radius: number
): { p1: Point; p2: Point } | null {
  const dx1 = A.x - B.x
  const dy1 = A.y - B.y
  const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1)

  const dx2 = C.x - B.x
  const dy2 = C.y - B.y
  const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2)

  if (len1 === 0 || len2 === 0) return null

  const r = Math.min(radius, len1 / 2, len2 / 2)

  return {
    p1: { x: B.x + r * (dx1 / len1), y: B.y + r * (dy1 / len1) },
    p2: { x: B.x + r * (dx2 / len2), y: B.y + r * (dy2 / len2) },
  }
}

/**
 * The contour's top-left corner, in grid px: the topmost item's own corner
 * (leftmost among those that share that top), expanded by the same margin the
 * path uses. The bounding box's corner is not it, since on an L-shaped
 * selection that point lies outside the contour.
 */
export function selectionPathCorner(
  items: ItemRect[],
  config: PixelConfig,
  margin = 6
): Point | null {
  let corner: Point | null = null
  for (const item of items) {
    const { left, top } = gridToPixelPosition(item.x, item.y, config)
    const x = left - margin
    const y = top - margin
    if (!corner || y < corner.y || (y === corner.y && x < corner.x)) {
      corner = { x, y }
    }
  }
  return corner
}

/**
 * Generates an SVG path wrapping the selected grid items with rounded corners.
 */
export function generateSelectionPath(
  items: ItemRect[],
  config: PixelConfig,
  margin = 6,
  borderRadius = 10
): string {
  if (items.length === 0) return ''

  // 1. Calculate expanded pixel rectangles
  const rects: PixelBounds[] = items.map(item => {
    const { left, top } = gridToPixelPosition(item.x, item.y, config)
    const { width, height } = gridToPixelDimensions(item.w, item.h, config)
    return {
      left: left - margin,
      top: top - margin,
      right: left + width + margin,
      bottom: top + height + margin,
    }
  })

  // 2. Collect boundary segments
  const rawHorizontal: CollinearInput[] = []
  const rawVertical: CollinearInput[] = []

  for (let i = 0; i < rects.length; i++) {
    const R = rects[i]

    const sides = [
      {
        val: R.top,
        range: [R.left, R.right] as [number, number],
        isHorizontal: true,
      },
      {
        val: R.bottom,
        range: [R.left, R.right] as [number, number],
        isHorizontal: true,
      },
      {
        val: R.left,
        range: [R.top, R.bottom] as [number, number],
        isHorizontal: false,
      },
      {
        val: R.right,
        range: [R.top, R.bottom] as [number, number],
        isHorizontal: false,
      },
    ]

    for (const side of sides) {
      let segments = [side.range]

      for (let j = 0; j < rects.length; j++) {
        if (i === j) continue
        const other = rects[j]

        if (side.isHorizontal) {
          if (other.top < side.val && side.val < other.bottom) {
            segments = subtractInterval(segments, other.left, other.right)
          }
        } else {
          if (other.left < side.val && side.val < other.right) {
            segments = subtractInterval(segments, other.top, other.bottom)
          }
        }
      }

      // Add remaining segments
      for (const [s, e] of segments) {
        if (s >= e) continue
        if (side.isHorizontal) {
          rawHorizontal.push({ coord: side.val, rangeStart: s, rangeEnd: e })
        } else {
          rawVertical.push({ coord: side.val, rangeStart: s, rangeEnd: e })
        }
      }
    }
  }

  // 3. Merge collinear segments
  const mergedHorizontal = groupAndMergeCollinear(rawHorizontal)
  const mergedVertical = groupAndMergeCollinear(rawVertical)

  // 4. Build graph & chain segments into loops
  let segmentIdCounter = 0
  const segmentsList: Segment[] = []
  const adj = new Map<string, Array<{ segment: Segment; other: Point }>>()

  const key = (p: Point) =>
    `${Math.round(p.x * 100) / 100},${Math.round(p.y * 100) / 100}`

  function addSegment(p1: Point, p2: Point) {
    const segment = { id: segmentIdCounter++, p1, p2 }
    segmentsList.push(segment)

    const k1 = key(p1)
    const k2 = key(p2)

    if (!adj.has(k1)) adj.set(k1, [])
    if (!adj.has(k2)) adj.set(k2, [])

    adj.get(k1)!.push({ segment, other: p2 })
    adj.get(k2)!.push({ segment, other: p1 })
  }

  for (const seg of mergedHorizontal) {
    addSegment(
      { x: seg.rangeStart, y: seg.coord },
      { x: seg.rangeEnd, y: seg.coord }
    )
  }
  for (const seg of mergedVertical) {
    addSegment(
      { x: seg.coord, y: seg.rangeStart },
      { x: seg.coord, y: seg.rangeEnd }
    )
  }

  const visited = new Set<number>()
  const loops: Point[][] = []

  for (const startSeg of segmentsList) {
    if (visited.has(startSeg.id)) continue

    const loop: Point[] = []
    let currentSeg = startSeg
    let currentPt = startSeg.p1
    let nextPt = startSeg.p2

    visited.add(currentSeg.id)
    loop.push(currentPt)

    const startPtKey = key(currentPt)

    while (true) {
      loop.push(nextPt)
      const nextPtKey = key(nextPt)
      if (nextPtKey === startPtKey) {
        break
      }

      const options = adj.get(nextPtKey) || []
      const nextOption = options.find(opt => !visited.has(opt.segment.id))
      if (!nextOption) {
        break
      }

      currentSeg = nextOption.segment
      visited.add(currentSeg.id)
      nextPt = nextOption.other
    }

    if (loop.length >= 5) {
      loop.pop() // Remove the duplicate starting point at the end
      loops.push(loop)
    }
  }

  // 5. Generate rounded SVG path string
  let pathStr = ''

  for (const loop of loops) {
    const n = loop.length
    if (n < 4) continue

    // Precalculate all corner points for the loop
    const corners = loop.map((B, idx) => {
      const A = loop[(idx - 1 + n) % n]
      const C = loop[(idx + 1) % n]
      return {
        B,
        pts: getCornerPoints(A, B, C, borderRadius),
      }
    })

    let loopPath = ''
    for (let i = 0; i < n; i++) {
      const curr = corners[i]
      if (!curr.pts) continue

      if (i === 0) {
        loopPath += `M ${curr.pts.p2.x.toFixed(1)},${curr.pts.p2.y.toFixed(1)}`
      } else {
        loopPath += ` L ${curr.pts.p1.x.toFixed(1)},${curr.pts.p1.y.toFixed(1)} Q ${curr.B.x.toFixed(1)},${curr.B.y.toFixed(1)} ${curr.pts.p2.x.toFixed(1)},${curr.pts.p2.y.toFixed(1)}`
      }
    }

    // Connect last to first corner
    const firstCorner = corners[0]
    if (firstCorner && firstCorner.pts) {
      loopPath += ` L ${firstCorner.pts.p1.x.toFixed(1)},${firstCorner.pts.p1.y.toFixed(1)} Q ${firstCorner.B.x.toFixed(1)},${firstCorner.B.y.toFixed(1)} ${firstCorner.pts.p2.x.toFixed(1)},${firstCorner.pts.p2.y.toFixed(1)} Z`
    } else {
      loopPath += ' Z'
    }

    pathStr += ' ' + loopPath
  }

  return pathStr.trim()
}
