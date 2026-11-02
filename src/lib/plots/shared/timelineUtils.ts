/**
 * Utility functions for creating nice, readable tick marks between exact bounds.
 * This implementation is mode-independent and focuses solely on display concerns.
 */

export interface TimelineTick {
  label: string
  value: number
  position: number
  isNice: boolean
}

export interface AdaptiveTimeline {
  minValue: number
  maxValue: number
  ticks: TimelineTick[]
}

/**
 * Format a tick label to be readable
 * @param value The value to format
 * @returns A formatted string representation
 */
export function formatTimelineLabel(value: number): string {
  // Guard against NaN or Infinity
  if (!Number.isFinite(value)) return '0'

  // Handle zero explicitly
  if (value === 0) return '0'

  // No thousands separators: a comma could be misread as a decimal comma.
  if (Number.isInteger(value)) return value.toString()

  // Large numbers with decimals
  if (Math.abs(value) >= 1000) return Math.round(value).toString()

  // Small numbers: determine precision based on magnitude
  const magnitude = Math.floor(Math.log10(Math.abs(value)))
  const digitsAfterDecimal = Math.min(20, Math.max(1, -magnitude + 1))

  return value.toLocaleString('en-US', {
    maximumFractionDigits: digitsAfterDecimal,
    minimumFractionDigits: 0,
    useGrouping: false,
  })
}

/**
 * Calculate a "nice" step size for readable ticks
 * @param range The range to divide
 * @param minTickCount Minimum number of ticks
 * @returns A step size that produces readable tick values
 */
export function calculateNiceStepSize(
  range: number,
  minTickCount: number
): number {
  if (range <= 0) return 1

  // Ensure we request at least 2 ticks to avoid division by zero (Infinity step)
  // causing infinite loops downstream.
  const safeTickCount = Math.max(2, minTickCount)

  // Initial step size estimation
  const stepSize = range / (safeTickCount - 1)

  // Round to a nice number based on magnitude
  const magnitude = Math.floor(Math.log10(stepSize))
  const normalized = stepSize / Math.pow(10, magnitude)

  // Choose a nice number among 1, 2, 2.5, 5, 10
  let niceNormalized: number
  if (normalized < 1.2) niceNormalized = 1
  else if (normalized < 2.2) niceNormalized = 2
  else if (normalized < 3.5) niceNormalized = 2.5
  else if (normalized < 7) niceNormalized = 5
  else niceNormalized = 10

  return niceNormalized * Math.pow(10, magnitude)
}

/**
 * Smallest nice step (1, 2, 2.5, 5, 10 × 10^n) that is ≥ `rawStep` — a strict
 * ceiling, so the resulting tick count never exceeds the target. Deliberately
 * NOT the same policy as {@link calculateNiceStepSize}, whose nearest-nice
 * rounding may round down to honour a MINIMUM tick count; swapping one for the
 * other changes tick placement (aoi-stream's Y axis relies on the ceiling).
 */
export function ceilToNiceStep(rawStep: number): number {
  const safeRaw = Math.max(1e-9, Math.abs(rawStep))
  const pow10 = Math.pow(10, Math.floor(Math.log10(safeRaw)))
  const fraction = safeRaw / pow10
  const niceFractions = [1, 2, 2.5, 5, 10]
  return (niceFractions.find(f => fraction <= f) ?? 10) * pow10
}

/**
 * Gets the position ratio (0-1) for a given value
 * @param timeline The timeline data or just min/max bounds
 * @param value The value to position
 * @param clamp Whether to clamp the value within the timeline bounds (default: true)
 * @returns A value between 0 and 1 representing the position
 */
export function getTimelinePositionRatio(
  timeline: { minValue: number; maxValue: number },
  value: number,
  clamp: boolean = true
): number {
  const { minValue, maxValue } = timeline
  if (maxValue <= minValue) return 0

  // Optional clamp value within bounds
  const usedValue = clamp
    ? Math.max(minValue, Math.min(value, maxValue))
    : value

  // Calculate position
  return (usedValue - minValue) / (maxValue - minValue)
}

/**
 * Gets all tick objects except the first and last
 * @param timeline The timeline data
 * @returns Array of intermediate ticks
 */
export function getIntermediateTicks(
  timeline: AdaptiveTimeline
): TimelineTick[] {
  return timeline.ticks.length > 2 ? timeline.ticks.slice(1, -1) : []
}

const tick = (value: number, position: number, isNice: boolean): TimelineTick => ({
  label: formatTimelineLabel(value),
  value,
  position,
  isNice,
})

/**
 * Core logic to generate ticks for a given range and step size
 */
function generateTimelineTicks(
  min: number,
  max: number,
  range: number,
  step: number
): TimelineTick[] {
  const ticks: TimelineTick[] = []

  // Safety check to prevent infinite loops if step invalid
  if (step <= 0 || !Number.isFinite(step)) {
    return [tick(min, 0, true), tick(max, 1, true)]
  }

  // Find a nice starting point (multiple of step)
  let currentValue = min
  if (min > 0) {
    currentValue = Math.floor(min / step) * step
    // If the nice start is below the actual min, move to the next step
    if (currentValue < min) {
      currentValue += step
    }
  }

  // Generate all ticks within the range - these are all "nice" ticks
  // Use a small epsilon to handle floating point precision issues
  let iterations = 0
  const MAX_ITERATIONS = 1000 // Safety break

  while (currentValue <= max + step * 0.0001) {
    ticks.push(tick(currentValue, (currentValue - min) / range, true))

    currentValue += step
    iterations++

    if (iterations > MAX_ITERATIONS) {
      console.warn(
        'Timeline tick generation exceeded max iterations, breaking.'
      )
      break
    }
  }

  // Ensure there's a tick at the max value if not already there
  if (ticks.length === 0 || ticks[ticks.length - 1].value < max) {
    ticks.push(tick(max, 1, false))
  }

  // Ensure there is a tick at the min value if not already there
  if (ticks.length === 0 || ticks[0].value > min) {
    ticks.unshift(tick(min, 0, false))
  }

  return ticks
}

/**
 * Creates a new AdaptiveTimeline with nice tick marks
 * @param minValue The start value (typically 0)
 * @param maxValue The end value (the exact maximum data value to display)
 * @param minTickCount Suggested minimum number of ticks (may be adjusted for readability)
 * @param roundToNiceMax If true, the timeline's maxValue will be rounded up to the next nice tick
 * @returns AdaptiveTimeline data object
 */
export function createAdaptiveTimeline(
  minValue: number = 0,
  maxValue: number = 0,
  minTickCount: number = 6,
  roundToNiceMax: boolean = false
): AdaptiveTimeline {
  const min = Math.max(0, minValue) // Ensure min value is never negative
  let max = Math.max(min, maxValue) // Ensure max >= min

  // Handle empty or invalid range
  if (max <= min) {
    return {
      minValue: min,
      maxValue: max,
      ticks: [tick(min, 0, true)],
    }
  }

  const range = max - min
  const step = calculateNiceStepSize(range, minTickCount)

  // Optionally round up to the next nice tick
  if (roundToNiceMax) {
    max = Math.ceil(max / step) * step
  }

  const ticks = generateTimelineTicks(min, max, max - min, step)

  return {
    minValue: min,
    maxValue: max,
    ticks,
  }
}

/**
 * Binary search for the interval holding `t` among `count` sorted, disjoint
 * half-open intervals; `-1` in a gap, outside them all, or for a `NaN` time.
 */
export function intervalAt(
  count: number,
  startOf: (i: number) => number,
  endOf: (i: number) => number,
  t: number
): number {
  let lo = 0
  let hi = count - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    // Negated, so a NaN fails both and falls out of the search as -1.
    if (!(t >= startOf(mid))) hi = mid - 1
    else if (!(t < endOf(mid))) lo = mid + 1
    else return mid
  }
  return -1
}
