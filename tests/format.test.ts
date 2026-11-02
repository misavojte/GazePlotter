import { describe, it, expect } from 'vitest'
import { formatDecimal, formatFileSize, formatSizeProgress } from '$lib/shared/format'

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

describe('formatFileSize', () => {
  it('picks the unit and trims trailing zeros', () => {
    expect(formatFileSize(0)).toBe('0 Bytes')
    expect(formatFileSize(512)).toBe('512 Bytes')
    expect(formatFileSize(1024)).toBe('1 KB')
    expect(formatFileSize(1.5 * 1024 ** 2)).toBe('1.5 MB')
    expect(formatFileSize(2 * 1024 ** 3)).toBe('2 GB')
  })

  it('stays in GB beyond it', () => {
    expect(formatFileSize(2048 * 1024 ** 3)).toBe('2048 GB')
  })
})

describe('formatSizeProgress', () => {
  it('counts in the total unit with one fixed decimal', () => {
    expect(formatSizeProgress(1.25 * 1024 ** 2, 4.08 * 1024 ** 2)).toBe('1.3 of 4.1 MB')
    expect(formatSizeProgress(0, 4 * 1024 ** 2)).toBe('0.0 of 4.0 MB')
    expect(formatSizeProgress(300 * 1024, 4 * 1024 ** 2)).toBe('0.3 of 4.0 MB')
  })

  it('counts whole bytes when the total is under a kilobyte', () => {
    expect(formatSizeProgress(3, 6)).toBe('3 of 6 Bytes')
  })

  it('uses its own unit without a total', () => {
    expect(formatSizeProgress(1.2 * 1024 ** 2, null)).toBe('1.2 MB')
    expect(formatSizeProgress(0, null)).toBe('0 Bytes')
  })
})
