import { describe, it, expect } from 'vitest'
import { computeBeeswarmPositions } from '$lib/plots/bar/core/renderers'

// --- Test helpers ---

/** Identity value function — raw value IS the pixel position */
const identity = (v: number) => v

type Pos = { valuePos: number; categoryPos: number }

/** Asserts no two dots are closer than minDist (Euclidean). Throws with details on failure. */
function assertNoOverlap(positions: Pos[], minDist: number): void {
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const dv = positions[i].valuePos - positions[j].valuePos
      const dc = positions[i].categoryPos - positions[j].categoryPos
      const dist = Math.sqrt(dv * dv + dc * dc)
      expect(
        dist,
        `Dots ${i} and ${j} overlap: dist=${dist.toFixed(3)}, minDist=${minDist.toFixed(3)}` +
          `\n  [${i}] value=${positions[i].valuePos}, cat=${positions[i].categoryPos.toFixed(2)}` +
          `\n  [${j}] value=${positions[j].valuePos}, cat=${positions[j].categoryPos.toFixed(2)}`
      ).toBeGreaterThanOrEqual(minDist - 0.001)
    }
  }
}

/** Asserts every dot is within maxSpread of categoryCenter. */
function assertWithinBounds(
  positions: Pos[],
  categoryCenter: number,
  maxSpread: number
): void {
  for (let i = 0; i < positions.length; i++) {
    const dist = Math.abs(positions[i].categoryPos - categoryCenter)
    expect(
      dist,
      `Dot ${i} out of bounds: cat=${positions[i].categoryPos.toFixed(2)}, ` +
        `center=${categoryCenter}, maxSpread=${maxSpread}`
    ).toBeLessThanOrEqual(maxSpread + 0.001)
  }
}

/** Counts how many dot-pairs overlap. */
function countOverlaps(positions: Pos[], minDist: number): number {
  let count = 0
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const dv = positions[i].valuePos - positions[j].valuePos
      const dc = positions[i].categoryPos - positions[j].categoryPos
      if (Math.sqrt(dv * dv + dc * dc) < minDist - 0.001) count++
    }
  }
  return count
}

// --- Test constants ---

// "Standard" params used by most tests
const CENTER = 100
const SPREAD = 50
const RADIUS = 5
const MIN_DIST = RADIUS * 2.2 // 11

describe('computeBeeswarmPositions', () => {
  // ----------------------------------------------------------------
  // Basic placement
  // ----------------------------------------------------------------
  describe('basic placement', () => {
    it('returns empty array for empty input', () => {
      const result = computeBeeswarmPositions([], identity, CENTER, SPREAD, RADIUS)
      expect(result).toEqual([])
    })

    it('places a single dot at the category center', () => {
      const result = computeBeeswarmPositions([50], identity, CENTER, SPREAD, RADIUS)
      expect(result).toHaveLength(1)
      expect(result[0].valuePos).toBe(50)
      expect(result[0].categoryPos).toBe(CENTER)
    })

    it('places two value-distant dots both at center', () => {
      // 50 px apart in value > minDist of 11 — no horizontal offset needed
      const result = computeBeeswarmPositions([0, 50], identity, CENTER, SPREAD, RADIUS)
      expect(result).toHaveLength(2)
      expect(result[0].categoryPos).toBe(CENTER)
      expect(result[1].categoryPos).toBe(CENTER)
    })
  })

  // ----------------------------------------------------------------
  // Center gravity
  // ----------------------------------------------------------------
  describe('center gravity', () => {
    it('two same-value dots are symmetric around center (neither at center)', () => {
      const result = computeBeeswarmPositions([50, 50], identity, CENTER, SPREAD, RADIUS)
      // Even count: dots at center ± step/2, NOT center and center+step
      const offsets = result.map(p => p.categoryPos - CENTER).sort((a, b) => a - b)
      expect(offsets[0]).toBeCloseTo(-MIN_DIST / 2, 1)
      expect(offsets[1]).toBeCloseTo(+MIN_DIST / 2, 1)
    })

    it('two similar-value dots are also symmetric around center', () => {
      // Values 50 and 51 are only 1px apart — within minDist of 11 —
      // so one displaces the other. The pair must still be centered.
      const result = computeBeeswarmPositions([50, 51], identity, CENTER, SPREAD, RADIUS)
      const offsets = result.map(p => p.categoryPos - CENTER).sort((a, b) => a - b)
      expect(offsets[0]).toBeCloseTo(-offsets[1], 1)
    })

    it('mean offset from center is small for a moderate cluster', () => {
      const result = computeBeeswarmPositions(
        [50, 50, 50],
        identity,
        CENTER,
        SPREAD,
        RADIUS
      )
      const avgDist =
        result.reduce((s, p) => s + Math.abs(p.categoryPos - CENTER), 0) /
        result.length
      // 3 dots cluster near center — avg distance much less than available spread
      expect(avgDist).toBeLessThan(SPREAD / 2)
    })

    it('dots far apart in value all sit at center', () => {
      // Each value pair is > minDist apart — every dot fits at center
      const values = [0, 20, 40, 60, 80]
      const result = computeBeeswarmPositions(values, identity, CENTER, SPREAD, RADIUS)
      for (const p of result) {
        expect(p.categoryPos).toBe(CENTER)
      }
    })
  })

  // ----------------------------------------------------------------
  // Symmetric layering from center
  // ----------------------------------------------------------------
  describe('symmetric layering', () => {
    it('identical values expand in symmetric rings', () => {
      const result = computeBeeswarmPositions(
        Array(7).fill(50),
        identity,
        CENTER,
        SPREAD,
        RADIUS
      )

      // Collect offsets from center, sorted by absolute distance
      const offsets = result
        .map(p => p.categoryPos - CENTER)
        .sort((a, b) => Math.abs(a) - Math.abs(b))

      // First dot at center
      expect(offsets[0]).toBeCloseTo(0, 0)

      // Remaining form +/- pairs at increasing distance
      for (let i = 1; i < offsets.length - 1; i += 2) {
        // Pair should have equal absolute values
        expect(Math.abs(offsets[i])).toBeCloseTo(Math.abs(offsets[i + 1]), 1)
        // One positive, one negative
        expect(offsets[i] * offsets[i + 1]).toBeLessThanOrEqual(0)
      }
    })

    it('distances from center are non-decreasing across layers', () => {
      const result = computeBeeswarmPositions(
        Array(9).fill(50),
        identity,
        CENTER,
        SPREAD,
        RADIUS
      )
      const distances = result
        .map(p => Math.abs(p.categoryPos - CENTER))
        .sort((a, b) => a - b)

      for (let i = 1; i < distances.length; i++) {
        expect(distances[i]).toBeGreaterThanOrEqual(distances[i - 1] - 0.001)
      }
    })
  })

  // ----------------------------------------------------------------
  // Overlap avoidance
  // ----------------------------------------------------------------
  describe('overlap avoidance', () => {
    it('no overlap for identical values that fit within spread', () => {
      // 5 dots at same value: needs ~5 positions along category axis
      const result = computeBeeswarmPositions(
        Array(5).fill(50),
        identity,
        CENTER,
        SPREAD,
        RADIUS
      )
      assertNoOverlap(result, MIN_DIST)
    })

    it('no overlap for a dense value cluster', () => {
      // Values within a few pixels of each other — forces 2D packing
      const values = [50, 51, 52, 50, 51, 52, 50, 51, 52]
      const result = computeBeeswarmPositions(values, identity, CENTER, SPREAD, RADIUS)
      assertNoOverlap(result, MIN_DIST)
    })

    it('values exactly minDist apart all fit at center', () => {
      const values = [0, 12, 24, 36, 48]
      const result = computeBeeswarmPositions(values, identity, CENTER, SPREAD, RADIUS)
      assertNoOverlap(result, MIN_DIST)
      for (const p of result) {
        expect(p.categoryPos).toBe(CENTER)
      }
    })

    it('no overlap when dot count fits within available positions', () => {
      // spread=50, minDist=11 → 9 positions: center, ±11, ±22, ±33, ±44
      const result = computeBeeswarmPositions(
        Array(9).fill(50),
        identity,
        CENTER,
        SPREAD,
        RADIUS
      )
      assertNoOverlap(result, MIN_DIST)
      assertWithinBounds(result, CENTER, SPREAD)
    })
  })

  // ----------------------------------------------------------------
  // Boundary respect
  // ----------------------------------------------------------------
  describe('boundary respect', () => {
    it('all dots stay within maxCategorySpread', () => {
      const result = computeBeeswarmPositions(
        Array(15).fill(50),
        identity,
        CENTER,
        SPREAD,
        RADIUS
      )
      assertWithinBounds(result, CENTER, SPREAD)
    })

    it('dots stay within a narrow spread', () => {
      const narrowSpread = 15
      const result = computeBeeswarmPositions(
        Array(8).fill(50),
        identity,
        CENTER,
        narrowSpread,
        RADIUS
      )
      assertWithinBounds(result, CENTER, narrowSpread)
    })

    it('no dot is placed outside bounds then clamped back (regression)', () => {
      // With radius=2, step=3.52. After ~14 dots the next candidate is
      // beyond spread and the OLD algorithm would clamp it back, causing
      // overlap with the outermost properly-placed dot.
      const smallRadius = 2
      const smallMinDist = smallRadius * 2.2 // 4.4
      const values = Array(20).fill(50)
      const result = computeBeeswarmPositions(
        values,
        identity,
        CENTER,
        SPREAD,
        smallRadius
      )

      assertWithinBounds(result, CENTER, SPREAD)

      // Dots near the boundary should NOT overlap — only center-fallback
      // dots (unavoidable when space is truly exhausted) may overlap.
      const boundary = SPREAD - smallMinDist
      const nearBoundary = result.filter(
        p => Math.abs(p.categoryPos - CENTER) > boundary
      )
      assertNoOverlap(nearBoundary, smallMinDist)
    })
  })

  // ----------------------------------------------------------------
  // Determinism
  // ----------------------------------------------------------------
  describe('determinism', () => {
    it('identical input produces identical output', () => {
      const values = [10, 20, 10, 30, 20, 10, 30, 20]
      const a = computeBeeswarmPositions(values, identity, CENTER, SPREAD, RADIUS)
      const b = computeBeeswarmPositions(values, identity, CENTER, SPREAD, RADIUS)
      expect(a).toEqual(b)
    })

    it('order of identical values does not change layout', () => {
      // Both arrays contain the same multiset, just shuffled
      const a = computeBeeswarmPositions(
        [10, 10, 20, 20, 30],
        identity,
        CENTER,
        SPREAD,
        RADIUS
      )
      const b = computeBeeswarmPositions(
        [20, 10, 30, 10, 20],
        identity,
        CENTER,
        SPREAD,
        RADIUS
      )
      // After sorting by value the placement order is the same,
      // so the result sets (when sorted) should match
      const sort = (arr: Pos[]) =>
        [...arr].sort(
          (x, y) => x.valuePos - y.valuePos || x.categoryPos - y.categoryPos
        )
      expect(sort(a)).toEqual(sort(b))
    })
  })

  // ----------------------------------------------------------------
  // Edge cases
  // ----------------------------------------------------------------
  describe('edge cases', () => {
    it('handles zero spread — all dots forced to center', () => {
      const result = computeBeeswarmPositions(
        Array(5).fill(50),
        identity,
        CENTER,
        0,
        RADIUS
      )
      expect(result).toHaveLength(5)
      for (const p of result) {
        expect(p.categoryPos).toBe(CENTER)
      }
    })

    it('handles very narrow category with many dots', () => {
      // Spread = 5 → only ~1 position per value-row
      const tinySpread = 5
      const result = computeBeeswarmPositions(
        Array(10).fill(50),
        identity,
        CENTER,
        tinySpread,
        RADIUS
      )
      expect(result).toHaveLength(10)
      assertWithinBounds(result, CENTER, tinySpread)
    })

    it('downsamples when exceeding MAX_POINTS (200)', () => {
      const result = computeBeeswarmPositions(
        Array(300).fill(50),
        identity,
        CENTER,
        SPREAD,
        RADIUS
      )
      expect(result.length).toBeLessThanOrEqual(200)
    })

    it('handles mixed clusters and isolated values', () => {
      const values = [10, 10, 10, 50, 50, 50, 50, 90, 90]
      const result = computeBeeswarmPositions(
        values,
        identity,
        CENTER,
        SPREAD,
        RADIUS
      )
      expect(result).toHaveLength(9)
      assertWithinBounds(result, CENTER, SPREAD)
      assertNoOverlap(result, MIN_DIST)
    })

    it('single-value arrays return one dot at center', () => {
      const result = computeBeeswarmPositions([42], identity, CENTER, SPREAD, RADIUS)
      expect(result).toEqual([{ valuePos: 42, categoryPos: CENTER }])
    })

    it('two identical values produce perfectly symmetric offsets', () => {
      const result = computeBeeswarmPositions(
        [50, 50],
        identity,
        CENTER,
        SPREAD,
        RADIUS
      )
      const offsets = result.map(p => p.categoryPos - CENTER).sort((a, b) => a - b)
      // Perfectly symmetric: one negative, one positive, equal magnitude
      expect(offsets[0]).toBeCloseTo(-offsets[1], 1)
      expect(offsets[0] + offsets[1]).toBeCloseTo(0, 1)
    })
  })

  // ----------------------------------------------------------------
  // Graceful degradation when space is exhausted
  // ----------------------------------------------------------------
  describe('space exhaustion', () => {
    it('places as many non-overlapping dots as possible', () => {
      // 30 dots at same value, radius=5 → each needs 11px of category space
      // Spread=50 → ~100px available → ~9 non-overlapping positions
      const values = Array(30).fill(50)
      const result = computeBeeswarmPositions(
        values,
        identity,
        CENTER,
        SPREAD,
        RADIUS
      )
      expect(result).toHaveLength(30)
      assertWithinBounds(result, CENTER, SPREAD)

      // Count how many unique, non-overlapping positions exist
      const unique: Pos[] = []
      for (const p of result) {
        const overlapsExisting = unique.some(u => {
          const dv = p.valuePos - u.valuePos
          const dc = p.categoryPos - u.categoryPos
          return Math.sqrt(dv * dv + dc * dc) < MIN_DIST - 0.001
        })
        if (!overlapsExisting) unique.push(p)
      }
      // Should have placed at least 8 non-overlapping dots
      // (theoretical max ~9 for 100px / 11px spacing)
      expect(unique.length).toBeGreaterThanOrEqual(8)
    })

    it('second layer fills midpoints between primary dots', () => {
      // With 15 same-value dots and radius=5, the first 9 fill the primary
      // grid (0, ±11, ±22, ±33, ±44). Dots 10-15 should form a second layer
      // at the midpoints (±5.5, ±16.5, ±27.5) — NOT pile at center.
      const values = Array(15).fill(50)
      const result = computeBeeswarmPositions(
        values,
        identity,
        CENTER,
        SPREAD,
        RADIUS
      )
      assertWithinBounds(result, CENTER, SPREAD)

      // Count distinct category positions (within 1px tolerance)
      const uniquePositions: number[] = []
      for (const p of result) {
        if (!uniquePositions.some(u => Math.abs(u - p.categoryPos) < 1)) {
          uniquePositions.push(p.categoryPos)
        }
      }
      // Primary layer: 9 positions. Second layer adds midpoints.
      // Should have significantly more than 9 distinct positions.
      expect(uniquePositions.length).toBeGreaterThanOrEqual(14)
    })

    it('overflow dots are distributed into gaps, not piled at boundaries', () => {
      // When all non-overlapping positions are taken, excess dots should fill
      // gaps between existing dots (second layer), not pile at boundaries.
      const smallRadius = 2
      const smallMinDist = smallRadius * 2.2
      const result = computeBeeswarmPositions(
        Array(30).fill(50),
        identity,
        CENTER,
        SPREAD,
        smallRadius
      )
      assertWithinBounds(result, CENTER, SPREAD)

      // Identify overflow dots: those that overlap with another dot
      const overflowIndices: number[] = []
      for (let i = 0; i < result.length; i++) {
        for (let j = 0; j < i; j++) {
          const dv = result[i].valuePos - result[j].valuePos
          const dc = result[i].categoryPos - result[j].categoryPos
          if (Math.sqrt(dv * dv + dc * dc) < smallMinDist - 0.001) {
            overflowIndices.push(i)
            break
          }
        }
      }

      // Overflow dots should be distributed — NOT all at center or all at edges.
      // Check that their average distance from center is moderate (not zero = piled
      // at center, not near spread = piled at edges).
      if (overflowIndices.length > 0) {
        const avgDist =
          overflowIndices.reduce(
            (s, idx) => s + Math.abs(result[idx].categoryPos - CENTER),
            0
          ) / overflowIndices.length
        // Should be spread out, not all at center (avgDist > 0)
        expect(avgDist).toBeGreaterThan(0)
        // Should not be concentrated at edges
        expect(avgDist).toBeLessThan(SPREAD * 0.8)
      }
    })
  })

  // ----------------------------------------------------------------
  // Value function transformation
  // ----------------------------------------------------------------
  describe('value function', () => {
    it('applies valueFn to transform values to pixel positions', () => {
      // Scale: value → value * 2
      const scale = (v: number) => v * 2
      const result = computeBeeswarmPositions([10, 20], scale, CENTER, SPREAD, RADIUS)
      // Values are sorted, so first is 10→20px, second is 20→40px
      expect(result[0].valuePos).toBe(20)
      expect(result[1].valuePos).toBe(40)
    })

    it('respects transformed positions for overlap checks', () => {
      // Two values that are close in raw space but far after transform
      const spread = (v: number) => v * 100
      const result = computeBeeswarmPositions([1, 2], spread, CENTER, SPREAD, RADIUS)
      // 100px apart in value space > minDist → both at center
      expect(result[0].categoryPos).toBe(CENTER)
      expect(result[1].categoryPos).toBe(CENTER)
    })
  })
})
