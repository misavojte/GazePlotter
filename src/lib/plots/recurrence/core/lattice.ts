/**
 * Fixation lattice geometry (pure, canvas-free).
 *
 * A fixation is a POSITION, not a cell: fixation k (0-based) sits exactly at
 * `k / (n - 1)` along each axis, so fixation 1 lies on the axis line and
 * fixation n on the opposite border. The square side spans n - 1 steps.
 */

/** Distance (px) between neighbouring fixations along a side of `side` px. */
export function latticeStep(n: number, side: number): number {
  return n > 1 ? side / (n - 1) : 0
}

/** Offset (px) of fixation `k` from the axis origin. */
export function latticeOffset(n: number, side: number, k: number): number {
  return k * latticeStep(n, side)
}

/**
 * The fixation nearest to `offset` px from the axis origin, or -1 when the
 * pointer is more than `slop` px beyond either end of the axis.
 */
export function nearestFixation(
  n: number,
  side: number,
  offset: number,
  slop: number
): number {
  if (n < 2 || side <= 0) return -1
  if (offset < -slop || offset > side + slop) return -1
  const k = Math.round(offset / latticeStep(n, side))
  return Math.min(n - 1, Math.max(0, k))
}
