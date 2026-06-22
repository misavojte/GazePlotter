import {
  buildDiagonalLineMask,
  buildHorizontalLineMask,
  buildVerticalLineMask,
} from '$lib/metrics/core/rqa'
import type { RecurrenceHighlight, RecurrenceMasking } from '../types'

/**
 * Build a full NxN highlight mask from a recurrence matrix. Plot-only: composes
 * the line-mask primitives from `$lib/metrics/core/rqa` according to the plot's
 * highlight / masking enums. Returns null when highlight is 'none'.
 */
export function buildHighlightMask(
  matrix: Uint8Array,
  N: number,
  highlight: RecurrenceHighlight,
  masking: RecurrenceMasking,
  minLineLength: number,
): Uint8Array | null {
  if (highlight === 'none') return null

  const showLower = masking !== 'diagonalLower'
  const mask = new Uint8Array(N * N)

  let lowerSrc: Uint8Array
  let upperSrc: Uint8Array

  if (highlight === 'diagonal') {
    const dMask = buildDiagonalLineMask(matrix, N, minLineLength)
    lowerSrc = dMask
    upperSrc = dMask
  } else if (highlight === 'horizontal') {
    lowerSrc = buildHorizontalLineMask(matrix, N, minLineLength)
    upperSrc = buildVerticalLineMask(matrix, N, minLineLength)
  } else {
    lowerSrc = buildVerticalLineMask(matrix, N, minLineLength)
    upperSrc = buildHorizontalLineMask(matrix, N, minLineLength)
  }

  if (showLower) {
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        if (lowerSrc[i * N + j]) mask[i * N + j] = 1
      }
    }
  }

  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      if (upperSrc[i * N + j]) mask[j * N + i] = 1
    }
  }

  return mask
}
