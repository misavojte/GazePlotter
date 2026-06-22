import { describe, it, expect } from 'vitest'
import { PlotSyncRegistry } from '../src/lib/plots/shared/PlotSyncRegistry.svelte'

interface TestEntry {
  groupKey: string
  w: number
  h: number
  dataMax: number
}

class TestRegistry extends PlotSyncRegistry<TestEntry> {
  // Expose the protected helper directly for unit-level testing of base
  // semantics; real plot subclasses wrap it with shape-specific public APIs.
  query(match: (e: TestEntry) => boolean): number {
    return this.maxWhere(match)
  }
}

describe('PlotSyncRegistry', () => {
  it('returns 0 when empty', () => {
    const r = new TestRegistry()
    expect(r.query(() => true)).toBe(0)
  })

  it('round-trips: set → maxWhere → clear', () => {
    const r = new TestRegistry()
    r.setEntry(1, { groupKey: 'a', w: 12, h: 10, dataMax: 100 })
    r.setEntry(2, { groupKey: 'a', w: 12, h: 10, dataMax: 250 })
    r.setEntry(3, { groupKey: 'b', w: 12, h: 10, dataMax: 999 }) // wrong group

    expect(r.query(e => e.groupKey === 'a' && e.w === 12 && e.h === 10)).toBe(250)

    r.clearEntry(2)
    expect(r.query(e => e.groupKey === 'a' && e.w === 12 && e.h === 10)).toBe(100)

    r.clearEntry(1)
    expect(r.query(e => e.groupKey === 'a' && e.w === 12 && e.h === 10)).toBe(0)
  })

  it('match predicate filters by arbitrary fields', () => {
    const r = new TestRegistry()
    r.setEntry(1, { groupKey: 'a', w: 12, h: 10, dataMax: 100 })
    r.setEntry(2, { groupKey: 'a', w: 6, h: 10, dataMax: 9999 }) // different w
    expect(r.query(e => e.w === 12)).toBe(100)
  })

  it('setEntry overwrites the same plotId', () => {
    const r = new TestRegistry()
    r.setEntry(1, { groupKey: 'a', w: 12, h: 10, dataMax: 50 })
    r.setEntry(1, { groupKey: 'a', w: 12, h: 10, dataMax: 200 })
    expect(r.query(() => true)).toBe(200)
  })
})
