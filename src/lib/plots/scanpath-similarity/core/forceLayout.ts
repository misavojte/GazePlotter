import type { ScangraphData } from '../types'

export type NodePosition = {
  x: number
  y: number
  vx: number
  vy: number
  id: number
  label: string
  degree: number
}

export type LayoutResult = {
  nodes: NodePosition[]
  links: { source: number; target: number; value: number }[]
}

/**
 * Deterministic seeded PRNG (mulberry32).
 * Returns a function that produces values in [0, 1).
 */
function seededRng(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Identify connected components via BFS.
 */
function findComponents(n: number, links: ScangraphData['links']): Int32Array {
  const adj: number[][] = Array.from({ length: n }, () => [])
  for (const link of links) {
    adj[link.source].push(link.target)
    adj[link.target].push(link.source)
  }

  const comp = new Int32Array(n).fill(-1)
  let compId = 0

  for (let start = 0; start < n; start++) {
    if (comp[start] !== -1) continue
    const queue = [start]
    comp[start] = compId
    let head = 0
    while (head < queue.length) {
      const cur = queue[head++]
      for (const nb of adj[cur]) {
        if (comp[nb] === -1) {
          comp[nb] = compId
          queue.push(nb)
        }
      }
    }
    compId++
  }

  return comp
}

/**
 * Boundary-aware force-directed layout.
 *
 * Key design:
 * - No post-hoc rescaling. The simulation itself is aware of the canvas
 *   boundaries and uses wall repulsion forces so nodes naturally spread
 *   to fill the space (including corners).
 * - Connected-component detection gives cross-component repulsion so
 *   natural groups separate visually.
 * - Deterministic seeded PRNG for consistent results across runs.
 */
export type ForceLayoutMargins = {
  top: number
  right: number
  bottom: number
  left: number
}

export function computeForceLayout(
  data: ScangraphData,
  width: number,
  height: number,
  iterations = 500,
  externalMargins?: ForceLayoutMargins
): LayoutResult {
  const { nodes: inputNodes, links } = data
  const n = inputNodes.length
  if (n === 0) return { nodes: [], links: [] }

  const rand = seededRng(42)

  // Compute degree and components
  const degree = new Int32Array(n)
  for (const link of links) {
    degree[link.source]++
    degree[link.target]++
  }
  const comp = findComponents(n, links)

  // Canvas geometry — external margins define the content area,
  // internal padding provides additional breathing room within it
  const em = externalMargins ?? { top: 0, right: 0, bottom: 0, left: 0 }
  const contentW = width - em.left - em.right
  const contentH = height - em.top - em.bottom
  const internalPad = Math.max(16, Math.min(contentW, contentH) * 0.05)
  const xMin = em.left + internalPad
  const xMax = width - em.right - internalPad
  const yMin = em.top + internalPad
  const yMax = height - em.bottom - internalPad
  const usableW = xMax - xMin
  const usableH = yMax - yMin
  const cx = em.left + contentW / 2
  const cy = em.top + contentH / 2

  // Initialise positions: seeded random scatter across the usable area
  const nodes: NodePosition[] = inputNodes.map((node, i) => ({
    x: xMin + rand() * usableW,
    y: yMin + rand() * usableH,
    vx: 0,
    vy: 0,
    id: node.id,
    label: node.label,
    degree: degree[i],
  }))

  // Single node — just center it
  if (n === 1) {
    nodes[0].x = cx
    nodes[0].y = cy
    return { nodes, links }
  }

  // --- Force parameters scaled to canvas and density ---
  const idealDist = Math.sqrt((usableW * usableH) / n)

  // Repulsion: strong enough to spread nodes across the full area
  const baseRepulsion = idealDist * idealDist
  const crossCompRepulsionMul = 2.5

  // Link attraction: pulls connected nodes toward idealDist apart
  const linkDist = idealDist * 0.35
  const linkStr = 0.07

  // Wall repulsion: pushes nodes away from edges so they don't pile up
  // at center — the walls effectively act like invisible nodes at the edges
  const wallStrength = idealDist * 0.8

  // Very gentle centering — just prevents total runaway, walls do the real work
  const centerStr = 0.002

  // --- Simulation ---
  for (let iter = 0; iter < iterations; iter++) {
    // Cooling schedule: starts hot, decays smoothly
    const t = iter / iterations
    const alpha = (1 - t) * (1 - t) // quadratic cooldown
    const step = alpha * idealDist * 0.08

    if (step < 0.01) break // converged

    // Reset forces
    for (let i = 0; i < n; i++) {
      nodes[i].vx = 0
      nodes[i].vy = 0
    }

    // 1) Node-node repulsion (stronger across components)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = nodes[i].x - nodes[j].x
        let dy = nodes[i].y - nodes[j].y
        let distSq = dx * dx + dy * dy
        if (distSq < 1) {
          // Deterministic jitter
          dx = (rand() - 0.5) * 2
          dy = (rand() - 0.5) * 2
          distSq = dx * dx + dy * dy
        }
        const dist = Math.sqrt(distSq)

        const mul = comp[i] !== comp[j] ? crossCompRepulsionMul : 1
        const force = (baseRepulsion * mul) / distSq
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force

        nodes[i].vx += fx
        nodes[i].vy += fy
        nodes[j].vx -= fx
        nodes[j].vy -= fy
      }
    }

    // 2) Link attraction
    for (const link of links) {
      const s = nodes[link.source]
      const t = nodes[link.target]
      const dx = t.x - s.x
      const dy = t.y - s.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 0.1) continue

      const displacement = dist - linkDist
      const force = displacement * linkStr
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force

      s.vx += fx
      s.vy += fy
      t.vx -= fx
      t.vy -= fy
    }

    // 3) Wall repulsion — each edge pushes nodes away, force ~ 1/dist²
    for (let i = 0; i < n; i++) {
      const distL = Math.max(1, nodes[i].x - xMin)
      const distR = Math.max(1, xMax - nodes[i].x)
      const distT = Math.max(1, nodes[i].y - yMin)
      const distB = Math.max(1, yMax - nodes[i].y)

      nodes[i].vx += wallStrength / (distL * distL)
      nodes[i].vx -= wallStrength / (distR * distR)
      nodes[i].vy += wallStrength / (distT * distT)
      nodes[i].vy -= wallStrength / (distB * distB)
    }

    // 4) Gentle center gravity (prevents oscillation, not clustering)
    for (let i = 0; i < n; i++) {
      nodes[i].vx += (cx - nodes[i].x) * centerStr
      nodes[i].vy += (cy - nodes[i].y) * centerStr
    }

    // 5) Apply forces with step-size limiting (prevents overshoot)
    for (let i = 0; i < n; i++) {
      const vx = nodes[i].vx
      const vy = nodes[i].vy
      const mag = Math.sqrt(vx * vx + vy * vy)
      if (mag < 0.001) continue

      const clampedStep = Math.min(step, mag)
      nodes[i].x += (vx / mag) * clampedStep
      nodes[i].y += (vy / mag) * clampedStep

      // Hard clamp to bounds
      nodes[i].x = Math.max(xMin, Math.min(xMax, nodes[i].x))
      nodes[i].y = Math.max(yMin, Math.min(yMax, nodes[i].y))
    }
  }

  return { nodes, links }
}
