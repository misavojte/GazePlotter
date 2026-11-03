import type { ScanpathSimilarityData } from '../types'

/**
 * A participant order that seats similar participants next to each other, so
 * groups show as blocks along the matrix diagonal: average-linkage
 * hierarchical clustering (UPGMA) on the similarities, leaves read left to
 * right. At each merge the two groups are flipped so their touching ends are
 * the most similar pair, a cheap stand-in for optimal leaf ordering. Pairs
 * without a value count as least similar (0). Ties merge the lowest indices
 * first, so the order is deterministic. O(n³), fine for participant counts.
 */
export function similarityOrder(matrix: ArrayLike<number>, size: number): number[] {
  const sim = (i: number, j: number) => {
    const v = matrix[i * size + j]
    return Number.isFinite(v) ? v : 0
  }
  // Mean similarity between live clusters, indexed by each cluster's first member.
  const mean = Float64Array.from(matrix, v => (Number.isFinite(v) ? v : 0))
  const members = Array.from({ length: size }, (_, i) => [i])
  const alive = new Array<boolean>(size).fill(true)

  for (let step = 1; step < size; step++) {
    let a = -1
    let b = -1
    let best = -Infinity
    for (let i = 0; i < size; i++) {
      if (!alive[i]) continue
      for (let j = i + 1; j < size; j++) {
        if (alive[j] && mean[i * size + j] > best) {
          best = mean[i * size + j]
          a = i
          b = j
        }
      }
    }
    const na = members[a].length
    const nb = members[b].length
    for (let k = 0; k < size; k++) {
      if (!alive[k] || k === a || k === b) continue
      const m = (na * mean[a * size + k] + nb * mean[b * size + k]) / (na + nb)
      mean[a * size + k] = m
      mean[k * size + a] = m
    }
    members[a] = joinClosestEnds(members[a], members[b], sim)
    alive[b] = false
  }
  // Merges keep the lower index, so cluster 0 is the one left.
  return members[0] ?? []
}

/** `left` then `right`, each possibly reversed, so the two leaves that meet are the most similar. */
function joinClosestEnds(left: number[], right: number[], sim: (i: number, j: number) => number): number[] {
  const l = [left, [...left].reverse()]
  const r = [right, [...right].reverse()]
  let best = [l[0], r[0]]
  let score = -Infinity
  for (const x of l) {
    for (const y of r) {
      const s = sim(x[x.length - 1], y[0])
      if (s > score) {
        score = s
        best = [x, y]
      }
    }
  }
  return [...best[0], ...best[1]]
}

/** The similarity data with participants permuted into `order`. */
export function reorderSimilarity(data: ScanpathSimilarityData, order: number[]): ScanpathSimilarityData {
  const { size, matrix } = data
  const out = new Float64Array(size * size)
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) out[i * size + j] = matrix[order[i] * size + order[j]]
  }
  return {
    ...data,
    labels: order.map(i => data.labels[i]),
    participantIds: order.map(i => data.participantIds[i]),
    matrix: out,
  }
}
