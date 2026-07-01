/**
 * Shared display budget (plots/shared/displayBudget).
 *
 * `resolveColumnBudget` maps a plot's real drawable pixel width to a window
 * budget (one window per pixel, no lower clamp, capped at a max-screen-width
 * ceiling; headless default when unmeasured). `resolveDisplayStride` decimates a
 * full window count to that budget by widening the step to an integer multiple.
 * The stride math is unit-agnostic — the same code serves ms-windowed (AOI
 * Timeline) and fixation-windowed (Metric Timeline) metrics.
 */
import { describe, it, expect } from 'vitest'
import {
  resolveColumnBudget,
  resolveDisplayStride,
  DEFAULT_MAX_COLUMNS,
} from '../src/lib/plots/shared/displayBudget'
import { calculatePlotWidthPx } from '../src/lib/plots/shared/plotSizeUtility'
import { DEFAULT_GRID_CONFIG } from '../src/lib/workspace/grid/const'

describe('resolveColumnBudget', () => {
  it('uses the headless default when width is unknown or non-positive', () => {
    expect(resolveColumnBudget(undefined)).toBe(DEFAULT_MAX_COLUMNS)
    expect(resolveColumnBudget(0)).toBe(DEFAULT_MAX_COLUMNS)
    expect(resolveColumnBudget(-3)).toBe(DEFAULT_MAX_COLUMNS)
  })

  it('is one window per drawable pixel', () => {
    expect(resolveColumnBudget(540)).toBe(540)
    expect(resolveColumnBudget(1920)).toBe(1920)
    expect(resolveColumnBudget(123.4)).toBe(123) // rounded
  })

  it('does NOT inflate small plots (no lower clamp)', () => {
    // A genuinely narrow plot can only show its own pixels — not a magic floor.
    expect(resolveColumnBudget(90)).toBe(90)
    expect(resolveColumnBudget(12)).toBe(12)
  })

  it('caps at the max-screen-width ceiling for very wide plots', () => {
    expect(resolveColumnBudget(5000)).toBe(DEFAULT_MAX_COLUMNS)
    expect(resolveColumnBudget(DEFAULT_MAX_COLUMNS + 1)).toBe(DEFAULT_MAX_COLUMNS)
  })
})

describe('budget is grounded in the real drawable pixel width', () => {
  // The whole point: columns track the actual on-screen canvas, computed from the
  // real grid geometry (cell + gap, minus body padding), NOT a hardcoded factor.
  it('calculatePlotWidthPx matches the grid geometry (cell + gap - body padding)', () => {
    const { cellSize, gap } = DEFAULT_GRID_CONFIG
    for (const w of [3, 12, 24]) {
      const totalPx = w * (cellSize.width + gap) - gap
      // GRID_ITEM_BODY_PADDING (25) × 2 sides = 50px of chrome.
      expect(calculatePlotWidthPx(w, DEFAULT_GRID_CONFIG)).toBe(totalPx - 50)
    }
  })

  it('a small plot yields far fewer columns than the old 256 floor', () => {
    // w=3 -> 3×50-10-50 = 90px -> 90 columns (was clamped up to 256 before).
    expect(resolveColumnBudget(calculatePlotWidthPx(3, DEFAULT_GRID_CONFIG))).toBe(90)
  })

  it('a typical plot budgets its true width, not units×50', () => {
    // w=12 -> 590-50 = 540px -> 540 columns (the old code gave 600).
    expect(resolveColumnBudget(calculatePlotWidthPx(12, DEFAULT_GRID_CONFIG))).toBe(540)
  })
})

describe('resolveDisplayStride', () => {
  it('keeps full resolution (stride 1) when the count already fits the budget', () => {
    const r = resolveDisplayStride(500, 10, 2048)
    expect(r.stride).toBe(1)
    expect(r.displayStep).toBe(10) // unchanged configured step
  })

  it('decimates to <= budget windows with an integer stride', () => {
    // 10000 configured windows, budget 50 -> stride ceil(10000/50) = 200.
    const r = resolveDisplayStride(10_000, 10, 50)
    expect(r.stride).toBe(200)
    expect(r.displayStep).toBe(200 * 10)
    // produced windows ≈ fullW / stride never exceeds the budget
    expect(Math.floor(10_000 / r.stride)).toBeLessThanOrEqual(50)
  })

  it('displayStep is always an integer multiple of the configured step', () => {
    for (const [full, step, budget] of [
      [9013, 7, 256],
      [123456, 3, 2048],
      [1000, 25, 30],
    ] as const) {
      const r = resolveDisplayStride(full, step, budget)
      expect(r.displayStep).toBe(r.stride * step)
      expect(r.stride).toBeGreaterThanOrEqual(1)
      expect(Math.ceil(full / r.stride)).toBeLessThanOrEqual(budget)
    }
  })

  it('is unit-agnostic: fixation-count inputs behave identically to ms', () => {
    // 3000 fixations at step 1, budget 256 -> stride 12, step in fixations.
    const r = resolveDisplayStride(3000, 1, 256)
    expect(r.stride).toBe(Math.ceil(3000 / 256))
    expect(r.displayStep).toBe(r.stride) // step 1 fixation -> displayStep in fixations
  })

  it('guards degenerate inputs (never returns stride < 1)', () => {
    expect(resolveDisplayStride(0, 10, 100).stride).toBe(1)
    expect(resolveDisplayStride(-5, 10, 100).stride).toBe(1)
    expect(resolveDisplayStride(100, 10, 0).stride).toBeGreaterThanOrEqual(1)
  })
})
