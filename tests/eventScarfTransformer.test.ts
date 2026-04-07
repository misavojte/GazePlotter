import { describe, expect, test } from 'vitest'
import { assignEventDepths } from '$lib/plots/scarf/core/transformer'

describe('assignEventDepths', () => {
  test('empty buffer returns maxDepth 1', () => {
    const { depths, maxDepth } = assignEventDepths([])
    expect(depths).toEqual([])
    expect(maxDepth).toBe(1)
  })

  test('single event gets depth 0', () => {
    // [start, duration]
    const { depths, maxDepth } = assignEventDepths([100, 500])
    expect(depths).toEqual([0])
    expect(maxDepth).toBe(1)
  })

  test('non-overlapping events share lane 0', () => {
    const { depths, maxDepth } = assignEventDepths([
      0, 100,
      200, 100,
      400, 100,
    ])
    expect(depths).toEqual([0, 0, 0])
    expect(maxDepth).toBe(1)
  })

  test('adjacent events (end == start) share same lane', () => {
    const { depths, maxDepth } = assignEventDepths([
      0, 100,
      100, 100,
    ])
    expect(depths).toEqual([0, 0])
    expect(maxDepth).toBe(1)
  })

  test('two overlapping events get different lanes', () => {
    const { depths, maxDepth } = assignEventDepths([
      0, 200,
      100, 200,
    ])
    expect(depths).toEqual([0, 1])
    expect(maxDepth).toBe(2)
  })

  test('three mutually overlapping events get three lanes', () => {
    const { depths, maxDepth } = assignEventDepths([
      0, 300,
      50, 300,
      100, 300,
    ])
    expect(depths).toEqual([0, 1, 2])
    expect(maxDepth).toBe(3)
  })

  test('lane reuse after earlier event ends', () => {
    // Event A: 0-100, Event B: 50-200, Event C: 150-250
    // A gets lane 0, B gets lane 1 (overlaps A), C fits in lane 0 (A ended at 100)
    const { depths, maxDepth } = assignEventDepths([
      0, 100,
      50, 150,
      150, 100,
    ])
    expect(depths).toEqual([0, 1, 0])
    expect(maxDepth).toBe(2)
  })

  test('out-of-order events are sorted by start time', () => {
    // Events given out of order: [300,100], [0,100], [150,100]
    const { depths, maxDepth } = assignEventDepths([
      300, 100,
      0, 100,
      150, 100,
    ])
    // Sorted by start: [0,100], [150,100], [300,100] — all non-overlapping
    // But depths array indices match original order
    expect(depths[0]).toBe(0) // event at 300 — lane 0
    expect(depths[1]).toBe(0) // event at 0 — lane 0
    expect(depths[2]).toBe(0) // event at 150 — lane 0
    expect(maxDepth).toBe(1)
  })

  test('instant events (duration 0) do not overlap each other', () => {
    const { depths, maxDepth } = assignEventDepths([
      100, 0,
      100, 0,
    ])
    // Both start at 100, end at 100. laneEnd <= start is 100 <= 100, so they fit in same lane
    expect(depths).toEqual([0, 0])
    expect(maxDepth).toBe(1)
  })

  test('instant event overlaps ongoing event', () => {
    // Long event: 0-200, instant at 100
    const { depths, maxDepth } = assignEventDepths([
      0, 200,
      100, 0,
    ])
    // Instant at 100 can't fit in lane 0 (laneEnd=200 > 100)
    expect(depths).toEqual([0, 1])
    expect(maxDepth).toBe(2)
  })

  test('complex staggered pattern', () => {
    // A: 0-100, B: 50-150, C: 100-200, D: 120-180, E: 200-300
    const { depths, maxDepth } = assignEventDepths([
      0, 100,   // A
      50, 100,  // B
      100, 100, // C
      120, 60,  // D
      200, 100, // E
    ])
    // Sorted by start: A(0), B(50), C(100), D(120), E(200)
    // A→lane0 (end=100), B→lane1 (end=150), C→lane0 (100<=100, end=200), D→lane1 (150>120? no! 150>120→lane2)
    // Wait: D starts at 120. Lane0 ends at 200 (>120), lane1 ends at 150 (>120) → D gets lane 2
    // E starts at 200. Lane0 ends at 200 (200<=200) → lane0
    expect(depths[0]).toBe(0) // A
    expect(depths[1]).toBe(1) // B
    expect(depths[2]).toBe(0) // C — fits lane 0 (100<=100)
    expect(depths[3]).toBe(2) // D — lane0 end=200>120, lane1 end=150>120 → new lane 2
    expect(depths[4]).toBe(0) // E — lane0 end=200<=200
    expect(maxDepth).toBe(3)
  })
})
