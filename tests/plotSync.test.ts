import { describe, it, expect } from 'vitest'
import { PlotSyncChannel, syncKey } from '../src/lib/plots/shared/plotSync.svelte'

describe('PlotSyncChannel', () => {
  it('returns 0 when nothing matches (the reader then keeps its own max)', () => {
    expect(new PlotSyncChannel().maxFor(syncKey(['absolute', 20]))).toBe(0)
  })

  it('round-trips: set → maxFor → clear', () => {
    const c = new PlotSyncChannel()
    const a = syncKey(['a', 12, 10])
    c.set(1, { key: a, dataMax: 100 })
    c.set(2, { key: a, dataMax: 250 })
    c.set(3, { key: syncKey(['b', 12, 10]), dataMax: 999 }) // another group

    expect(c.maxFor(a)).toBe(250)
    c.clear(2)
    expect(c.maxFor(a)).toBe(100)
    c.clear(1)
    expect(c.maxFor(a)).toBe(0)
  })

  it('set overwrites the same plot id', () => {
    const c = new PlotSyncChannel()
    const k = syncKey([12])
    c.set(1, { key: k, dataMax: 50 })
    c.set(1, { key: k, dataMax: 200 })
    expect(c.maxFor(k)).toBe(200)
    c.set(1, { key: k, dataMax: 20 })
    expect(c.maxFor(k)).toBe(20)
  })

  it('an opted-in plot with no data contributes nothing', () => {
    const c = new PlotSyncChannel()
    const k = syncKey([6])
    c.set(1, { key: k, dataMax: 0 })
    c.set(2, { key: k, dataMax: 300 })
    expect(c.maxFor(k)).toBe(300)
  })
})

describe('syncKey', () => {
  it('compares parts as a tuple, so no separator inside a part can collide', () => {
    expect(syncKey(['a|b', 'c'])).not.toBe(syncKey(['a', 'b|c']))
    expect(syncKey(['1', 2])).not.toBe(syncKey([1, 2]))
    expect(syncKey(['absolute', 20])).toBe(syncKey(['absolute', 20]))
  })
})
