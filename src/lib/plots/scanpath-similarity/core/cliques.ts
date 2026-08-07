import type { ScangraphLink } from '../types'

/**
 * Maximal cliques of the thresholded scangraph — the ScanGraph paper's
 * "groups of similar participants". Bron-Kerbosch with pivoting; the ops
 * budget bails on pathologically dense graphs instead of hanging the UI.
 */
const OPS_BUDGET = 200_000

/** Maximal cliques with two or more members, as ascending node-index lists,
 *  largest first. Returns null when the ops budget is exceeded. */
export function maximalCliques(
  nodeCount: number,
  links: readonly ScangraphLink[]
): number[][] | null {
  const adj: Set<number>[] = Array.from({ length: nodeCount }, () => new Set())
  for (const { source, target } of links) {
    adj[source].add(target)
    adj[target].add(source)
  }

  const cliques: number[][] = []
  let ops = 0

  // R = current clique, P = candidates, X = already covered.
  const expand = (r: number[], p: Set<number>, x: Set<number>): boolean => {
    if (++ops > OPS_BUDGET) return false
    if (p.size === 0 && x.size === 0) {
      if (r.length >= 2) cliques.push([...r].sort((a, b) => a - b))
      return true
    }
    // Pivot with the most candidate neighbours prunes the branching (Tomita).
    let pivot = -1
    let best = -1
    for (const set of [p, x]) {
      for (const v of set) {
        let count = 0
        for (const u of p) if (adj[v].has(u)) count++
        if (count > best) {
          best = count
          pivot = v
        }
      }
    }
    const candidates = [...p].filter(v => !adj[pivot].has(v))
    for (const v of candidates) {
      const pv = new Set<number>()
      const xv = new Set<number>()
      for (const u of p) if (adj[v].has(u)) pv.add(u)
      for (const u of x) if (adj[v].has(u)) xv.add(u)
      r.push(v)
      if (!expand(r, pv, xv)) return false
      r.pop()
      p.delete(v)
      x.add(v)
    }
    return true
  }

  // Isolated vertices can never sit in a clique of two.
  const connected = new Set<number>()
  for (let v = 0; v < nodeCount; v++) if (adj[v].size > 0) connected.add(v)
  if (!expand([], connected, new Set())) return null

  cliques.sort((a, b) => b.length - a.length || a[0] - b[0])
  return cliques
}
