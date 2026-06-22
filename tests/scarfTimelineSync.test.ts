import { describe, it, expect, afterEach } from 'vitest'
import { scarfTimelineSync } from '../src/lib/plots/scarf/core/sync.svelte'

// Shared singleton — clear the ids each test registers so cases don't bleed.
afterEach(() => {
  for (const id of [1, 2, 3]) scarfTimelineSync.clearEntry(id)
})

describe('ScarfTimelineSync', () => {
  it('returns 0 when nothing matches (caller falls back to its own max)', () => {
    expect(scarfTimelineSync.getSyncedMax('absolute', 20)).toBe(0)
  })

  it('syncs same-width plots regardless of height', () => {
    // The synced axis is the horizontal timeline — its pixel scale depends on
    // width alone, so two same-width scarfs of differing heights must share a
    // max. (Regression: height was once part of the match key, splitting them.)
    scarfTimelineSync.setEntry(1, { timeline: 'absolute', w: 20, dataMax: 100 })
    scarfTimelineSync.setEntry(2, { timeline: 'absolute', w: 20, dataMax: 300 })
    expect(scarfTimelineSync.getSyncedMax('absolute', 20)).toBe(300)
  })

  it('does not sync across different widths', () => {
    scarfTimelineSync.setEntry(1, { timeline: 'absolute', w: 20, dataMax: 100 })
    scarfTimelineSync.setEntry(2, { timeline: 'absolute', w: 14, dataMax: 999 })
    expect(scarfTimelineSync.getSyncedMax('absolute', 20)).toBe(100)
  })

  it('does not sync across different timeline modes', () => {
    scarfTimelineSync.setEntry(1, { timeline: 'absolute', w: 20, dataMax: 100 })
    scarfTimelineSync.setEntry(2, { timeline: 'ordinal', w: 20, dataMax: 999 })
    expect(scarfTimelineSync.getSyncedMax('absolute', 20)).toBe(100)
  })
})
