/**
 * Scanpath similarity algorithms.
 *
 * Levenshtein: edit distance normalized to 0-1 similarity.
 * Needleman-Wunsch: global alignment score normalized to 0-1 similarity.
 */

/**
 * Compute Levenshtein edit distance between two strings.
 * Returns raw distance (number of edits).
 */
function levenshteinDistance(
  a: string,
  b: string,
  costIns = 1,
  costDel = 1,
  costRep = 1
): number {
  const m = a.length
  const n = b.length

  // Single-row DP for memory efficiency
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

/**
 * Needleman-Wunsch global alignment score.
 * Returns the optimal alignment score.
 */
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

/**
 * Compute normalized Levenshtein similarity (0-1, where 1 = identical).
 */
export function levenshteinSimilarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1
  const maxLen = Math.max(a.length, b.length)
  const distance = levenshteinDistance(a, b)
  return 1 - distance / maxLen
}

/**
 * Compute normalized Needleman-Wunsch similarity (0-1, where 1 = identical).
 */
export function needlemanWunschSimilarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1
  const maxLen = Math.max(a.length, b.length)
  const score = needlemanWunschScore(a, b)
  // NW score ranges from maxLen*gapPenalty (worst) to maxLen*matchScore (best)
  // With defaults: worst = -maxLen, best = maxLen
  // Normalize: (score - worst) / (best - worst)
  const best = maxLen // maxLen * matchScore(1)
  const worst = -maxLen // maxLen * gapPenalty(-1)
  return (score - worst) / (best - worst)
}
