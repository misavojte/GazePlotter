/**
 * Pairwise similarity kernels for AOI-letter scanpaths.
 *
 * Levenshtein: edit distance normalized to 0-1 similarity.
 * Needleman-Wunsch: global alignment score normalized to 0-1 similarity.
 */

export type SimilarityMethod = 'levenshtein' | 'needlemanWunsch'

function levenshteinDistance(
  a: string,
  b: string,
  costIns = 1,
  costDel = 1,
  costRep = 1
): number {
  const m = a.length
  const n = b.length

  const prev = new Float64Array(n + 1)
  const curr = new Float64Array(n + 1)

  for (let j = 0; j <= n; j++) prev[j] = j * costIns

  for (let i = 1; i <= m; i++) {
    curr[0] = i * costDel
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1]
      } else {
        curr[j] = Math.min(
          prev[j] + costDel,
          curr[j - 1] + costIns,
          prev[j - 1] + costRep
        )
      }
    }
    prev.set(curr)
  }

  return prev[n]
}

function needlemanWunschScore(
  a: string,
  b: string,
  matchScore = 1,
  mismatchScore = -1,
  gapPenalty = -1
): number {
  const m = a.length
  const n = b.length

  const prev = new Float64Array(n + 1)
  const curr = new Float64Array(n + 1)

  for (let j = 0; j <= n; j++) prev[j] = j * gapPenalty

  for (let i = 1; i <= m; i++) {
    curr[0] = i * gapPenalty
    for (let j = 1; j <= n; j++) {
      const match = prev[j - 1] + (a[i - 1] === b[j - 1] ? matchScore : mismatchScore)
      const del = prev[j] + gapPenalty
      const ins = curr[j - 1] + gapPenalty
      curr[j] = Math.max(match, del, ins)
    }
    prev.set(curr)
  }

  return prev[n]
}

/** Normalized Levenshtein similarity (0-1, where 1 = identical). */
export function levenshteinSimilarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1
  const maxLen = Math.max(a.length, b.length)
  const distance = levenshteinDistance(a, b)
  return 1 - distance / maxLen
}

/** Normalized Needleman-Wunsch similarity (0-1, where 1 = identical). */
export function needlemanWunschSimilarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1
  const maxLen = Math.max(a.length, b.length)
  const score = needlemanWunschScore(a, b)
  // NW score ranges from maxLen*gapPenalty (worst) to maxLen*matchScore (best)
  // With defaults: worst = -maxLen, best = maxLen
  const best = maxLen
  const worst = -maxLen
  return (score - worst) / (best - worst)
}

const SIMILARITY_FN: Record<SimilarityMethod, (a: string, b: string) => number> = {
  levenshtein: levenshteinSimilarity,
  needlemanWunsch: needlemanWunschSimilarity,
}

/**
 * Compute a symmetric pairwise similarity matrix (flat row-major) over a set of
 * scanpaths using the chosen kernel. Diagonal = 1; off-diagonal cells are
 * rounded to three decimals to keep label readouts stable.
 */
export function computeSimilarityMatrix(
  scanpaths: readonly string[],
  method: SimilarityMethod,
): number[] {
  const size = scanpaths.length
  const matrix = new Array<number>(size * size).fill(0)
  const compute = SIMILARITY_FN[method]
  for (let i = 0; i < size; i++) {
    matrix[i * size + i] = 1
    for (let j = i + 1; j < size; j++) {
      const sim = compute(scanpaths[i], scanpaths[j])
      const rounded = Math.round(sim * 1000) / 1000
      matrix[i * size + j] = rounded
      matrix[j * size + i] = rounded
    }
  }
  return matrix
}
