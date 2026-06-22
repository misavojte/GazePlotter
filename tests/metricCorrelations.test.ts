import { describe, it, expect } from 'vitest'
import {
  pearson,
  spearman,
  correlate,
  rank,
} from '$lib/plots/metric-correlation/core/correlations'

describe('metric-correlation correlations', () => {
  describe('pearson', () => {
    it('returns r = 1 for perfectly correlated vectors', () => {
      const { r, n } = pearson([1, 2, 3, 4, 5], [2, 4, 6, 8, 10])
      expect(r).toBeCloseTo(1, 10)
      expect(n).toBe(5)
    })

    it('returns r = -1 for perfectly anti-correlated vectors', () => {
      const { r, n } = pearson([1, 2, 3, 4, 5], [10, 8, 6, 4, 2])
      expect(r).toBeCloseTo(-1, 10)
      expect(n).toBe(5)
    })

    it('matches a known fixture', () => {
      // Classic textbook example: r ≈ 0.9746318
      const { r } = pearson([43, 21, 25, 42, 57, 59], [99, 65, 79, 75, 87, 81])
      expect(r).not.toBeNull()
      expect(r!).toBeCloseTo(0.5298, 3)
    })

    it('drops NaN pairs before computing n', () => {
      const { n } = pearson([1, 2, NaN, 4, 5], [2, NaN, 6, 8, 10])
      expect(n).toBe(3)
    })

    it('returns null when n < 3', () => {
      const { r, n } = pearson([1, 2], [3, 4])
      expect(r).toBeNull()
      expect(n).toBe(2)
    })

    it('returns null when a vector is constant (zero variance)', () => {
      const { r, n } = pearson([1, 1, 1, 1], [2, 4, 6, 8])
      expect(r).toBeNull()
      expect(n).toBe(4)
    })

    it('throws when vector lengths differ', () => {
      expect(() => pearson([1, 2], [1, 2, 3])).toThrow()
    })
  })

  describe('rank', () => {
    it('assigns fractional ranks for ties', () => {
      expect(rank([10, 20, 20, 30])).toEqual([1, 2.5, 2.5, 4])
    })

    it('ranks monotonic ascending vectors in order', () => {
      expect(rank([5, 10, 15])).toEqual([1, 2, 3])
    })

    it('preserves input index alignment', () => {
      expect(rank([30, 10, 20])).toEqual([3, 1, 2])
    })
  })

  describe('spearman', () => {
    it('returns r = 1 for any monotonic increasing relationship', () => {
      const { r } = spearman([1, 2, 3, 4, 5], [1, 100, 1000, 10000, 100000])
      expect(r).toBeCloseTo(1, 10)
    })

    it('returns r = -1 for any monotonic decreasing relationship', () => {
      const { r } = spearman([1, 2, 3, 4, 5], [100, 50, 25, 10, 1])
      expect(r).toBeCloseTo(-1, 10)
    })

    it('drops NaN pairs before ranking', () => {
      const { n } = spearman([1, 2, NaN, 4], [5, NaN, 7, 8])
      expect(n).toBe(2)
    })

    it('returns null when n < 3', () => {
      const { r, n } = spearman([1, 2], [3, 4])
      expect(r).toBeNull()
      expect(n).toBe(2)
    })
  })

  describe('correlate dispatcher', () => {
    it('routes to pearson', () => {
      const linear = correlate([1, 2, 3, 4], [2, 4, 6, 8], 'pearson')
      expect(linear.r).toBeCloseTo(1, 10)
    })

    it('routes to spearman', () => {
      const monotonic = correlate([1, 2, 3, 4], [1, 10, 100, 1000], 'spearman')
      expect(monotonic.r).toBeCloseTo(1, 10)
      const linearPearson = correlate([1, 2, 3, 4], [1, 10, 100, 1000], 'pearson')
      expect(linearPearson.r).not.toBeCloseTo(1, 2)
    })
  })
})
