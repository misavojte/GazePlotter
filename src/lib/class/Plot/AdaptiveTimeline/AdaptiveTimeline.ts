/**
 * AdaptiveTimeline class for creating nice, readable tick marks between exact bounds
 * This implementation is mode-independent and focuses solely on display concerns
 */
export class AdaptiveTimeline {
  /** The actual start value of the timeline */
  private _minValue: number = 0
  /** The actual end value of the timeline */
  private _maxValue: number = 0
  /** The tick objects with label and position information */
  private _ticks: Array<{
    label: string
    value: number
    position: number
    isNice: boolean
  }> = []

  /**
   * Creates a new AdaptiveTimeline with nice tick marks
   * @param minValue The start value (typically 0)
   * @param maxValue The end value (the exact maximum data value to display)
   * @param minTickCount Suggested minimum number of ticks (may be adjusted for readability)
   */
  constructor(
    minValue: number = 0,
    maxValue: number = 0,
    minTickCount: number = 6
  ) {
    this._minValue = Math.max(0, minValue) // Ensure min value is never negative
    this._maxValue = Math.max(this._minValue, maxValue) // Ensure max >= min
    this._generateTicks(minTickCount)
  }

  /**
   * Generate readable tick values within the bounds
   * @param minTickCount Minimum number of ticks to display
   */
  private _generateTicks(minTickCount: number): void {
    // Clear existing ticks
    this._ticks = []

    // Handle empty or invalid range
    if (this._maxValue <= this._minValue) {
      this._ticks = [
        {
          label: '0',
          value: 0,
          position: 0,
          isNice: true,
        },
      ]
      return
    }

    // Calculate the range
    const range = this._maxValue - this._minValue

    // Calculate a nice step size
    const step = this._calculateNiceStepSize(range, minTickCount)

    // Find a nice starting point (multiple of step)
    let currentValue = this._minValue
    // If not starting at zero, find a nice starting tick
    if (this._minValue > 0) {
      currentValue = Math.floor(this._minValue / step) * step
      // If the nice start is below the actual min, move to the next step
      if (currentValue < this._minValue) {
        currentValue += step
      }
    }

    // Generate all ticks within the range - these are all "nice" ticks
    while (currentValue <= this._maxValue) {
      // Calculate the relative position (0-1)
      const position = (currentValue - this._minValue) / range

      // Format the label (avoid scientific notation, handle decimal precision)
      let label = this._formatTickLabel(currentValue)

      this._ticks.push({
        label,
        value: currentValue,
        position,
        isNice: true,
      })

      currentValue += step
    }

    // Ensure there's a tick at the max value if not already there
    const lastTick = this._ticks[this._ticks.length - 1]
    if (lastTick.value < this._maxValue) {
      this._ticks.push({
        label: this._formatTickLabel(this._maxValue),
        value: this._maxValue,
        position: 1,
        isNice: false,
      })
    }

    // Ensure there is a tick at the min value if not already there
    const firstTick = this._ticks[0]
    if (firstTick.value > this._minValue) {
      this._ticks.unshift({
        label: this._formatTickLabel(this._minValue),
        value: this._minValue,
        position: 0,
        isNice: false,
      })
    }
  }

  /**
   * Format a tick label to be readable
   * @param value The value to format
   * @returns A formatted string representation
   */
  private _formatTickLabel(value: number): string {
    // For integers or large numbers, show without decimals
    if (Number.isInteger(value) || Math.abs(value) >= 1000) {
      return value.toLocaleString('en-US', { maximumFractionDigits: 0 })
    }

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
  private _calculateNiceStepSize(range: number, minTickCount: number): number {
    // Initial step size estimation
    let stepSize = range / (minTickCount - 1)

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
   * Gets all tick objects
   */
  get ticks(): Array<{
    label: string
    value: number
    position: number
    isNice: boolean
  }> {
    return [...this._ticks]
  }

  /**
   * Gets all tick objects except the first and last
   */
  get intermediateTicks(): Array<{
    label: string
    value: number
    position: number
    isNice: boolean
  }> {
    return this._ticks.length > 2 ? this._ticks.slice(1, -1) : []
  }

  /**
   * Gets the minimum value of the timeline
   */
  get minValue(): number {
    return this._minValue
  }

  /**
   * Gets the maximum value of the timeline
   */
  get maxValue(): number {
    return this._maxValue
  }

  /**
   * Gets the position ratio (0-1) for a given value
   * @param value The value to position
   * @returns A value between 0 and 1 representing the position
   */
  getPositionRatio(value: number): number {
    // Handle empty or single-point ranges
    if (this._maxValue <= this._minValue) return 0

    // Ensure value is within bounds
    const clampedValue = Math.max(
      this._minValue,
      Math.min(value, this._maxValue)
    )

    // Calculate position
    return (clampedValue - this._minValue) / (this._maxValue - this._minValue)
  }
}
