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
  // For integers or large numbers, show without decimals
  if (Number.isInteger(value) || Math.abs(value) >= 1000) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 })
  }

  // Handle zero explicitly
  if (value === 0) return '0'

  // For smaller numbers with decimals, show with appropriate precision
  const magnitude = Math.floor(Math.log10(Math.abs(value)))
  const digitsAfterDecimal = Math.max(0, -magnitude + 1)
  return value.toLocaleString('en-US', {
    maximumFractionDigits: digitsAfterDecimal,
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

  // Initial step size estimation
  const stepSize = range / (minTickCount - 1)

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
 * Gets the position ratio (0-1) for a given value
 * @param timeline The timeline data or just min/max bounds
 * @param value The value to position
 * @returns A value between 0 and 1 representing the position
 */
export function getTimelinePositionRatio(
  timeline: { minValue: number; maxValue: number },
  value: number
): number {
  const { minValue, maxValue } = timeline
  if (maxValue <= minValue) return 0

  // Ensure value is within bounds
  const clampedValue = Math.max(minValue, Math.min(value, maxValue))

  // Calculate position
  return (clampedValue - minValue) / (maxValue - minValue)
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
  while (currentValue <= max + step * 0.0001) {
    ticks.push({
      label: formatTimelineLabel(currentValue),
      value: currentValue,
      position: (currentValue - min) / range,
      isNice: true,
    })

    currentValue += step
  }

  // Ensure there's a tick at the max value if not already there
  if (ticks.length === 0 || ticks[ticks.length - 1].value < max) {
    ticks.push({
      label: formatTimelineLabel(max),
      value: max,
      position: 1,
      isNice: false,
    })
  }

  // Ensure there is a tick at the min value if not already there
  if (ticks.length === 0 || ticks[0].value > min) {
    ticks.unshift({
      label: formatTimelineLabel(min),
      value: min,
      position: 0,
      isNice: false,
    })
  }

  return ticks
}

/**
 * Creates a new AdaptiveTimeline with nice tick marks
 * @param minValue The start value (typically 0)
 * @param maxValue The end value (the exact maximum data value to display)
 * @param minTickCount Suggested minimum number of ticks (may be adjusted for readability)
 * @returns AdaptiveTimeline data object
 */
export function createAdaptiveTimeline(
  minValue: number = 0,
  maxValue: number = 0,
  minTickCount: number = 6
): AdaptiveTimeline {
  const min = Math.max(0, minValue) // Ensure min value is never negative
  const max = Math.max(min, maxValue) // Ensure max >= min

  // Handle empty or invalid range
  if (max <= min) {
    return {
      minValue: min,
      maxValue: max,
      ticks: [
        {
          label: '0',
          value: 0,
          position: 0,
          isNice: true,
        },
      ],
    }
  }

  const range = max - min
  const step = calculateNiceStepSize(range, minTickCount)
  const ticks = generateTimelineTicks(min, max, range, step)

  return {
    minValue: min,
    maxValue: max,
    ticks,
  }
}
