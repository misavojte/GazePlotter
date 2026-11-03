/**
 * The participant-by-participant matrix every similarity recipe returns:
 * symmetric, row-major, rounded to three decimals so labels stay stable.
 *
 * One rule for missing data, so all similarity metrics read alike. NaN means
 * "no value", never a score. A `null` item (a participant with nothing to
 * compare) leaves its whole row and column empty. The diagonal is each item
 * scored against itself, so a self-comparison the score cannot make (two
 * empty scanpaths are 0/0) stays empty too.
 */
export function pairMatrix<T>(items: readonly (T | null)[], score: (a: T, b: T) => number): number[] {
  const n = items.length
  const matrix = new Array<number>(n * n).fill(NaN)
  for (let i = 0; i < n; i++) {
    const a = items[i]
    if (a === null) continue
    for (let j = i; j < n; j++) {
      const b = items[j]
      if (b === null) continue
      const value = Math.round(score(a, b) * 1000) / 1000
      matrix[i * n + j] = value
      matrix[j * n + i] = value
    }
  }
  return matrix
}
