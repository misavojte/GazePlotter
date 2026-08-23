import { describe, it, expect } from 'vitest'
import { formatDecimal } from '$lib/shared/format'

describe('formatDecimal', () => {
  it('should format to specified decimal places', () => {
    expect(formatDecimal(3.14159, 2)).toBe(3.14)
    expect(formatDecimal(3.14159, 3)).toBe(3.142)
    expect(formatDecimal(3.14159, 0)).toBe(3)
  })

  it('should use default decimal places (1)', () => {
    expect(formatDecimal(3.14159)).toBe(3.1)
  })

  it('should round correctly', () => {
    expect(formatDecimal(3.15, 1)).toBe(3.2) // Round up
    expect(formatDecimal(3.14, 1)).toBe(3.1) // Round down
    expect(formatDecimal(3.145, 2)).toBe(3.15) // Round half up
  })

  it('should handle zero and negative numbers', () => {
    expect(formatDecimal(0, 2)).toBe(0)
    expect(formatDecimal(-3.14159, 2)).toBe(-3.14)
  })
})
