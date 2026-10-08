import { describe, expect, it } from 'vitest'
import { hoverKeyChanged } from '$lib/plots/shared/usePlot.svelte'

// The dedup gate in front of a figure's `onHover` (which publishes the shared
// plot cursor). A missed change leaves another plot's highlight stuck on.

type Hit = { fixationIndex: number | null }
const byFixation = (d: Hit) => d.fixationIndex

describe('hoverKeyChanged', () => {
  it('fires on leaving after a hit whose own key is null', () => {
    // Scanpath: hovering empty panel space is a hit keyed null; leaving the
    // plot must still fire, or the scarf keeps the participant highlighted.
    expect(hoverKeyChanged<Hit>({ fixationIndex: null }, null, byFixation)).toBe(true)
    expect(hoverKeyChanged<Hit>(null, { fixationIndex: null }, byFixation)).toBe(true)
  })

  it('stays quiet while the key holds, across fresh hit objects', () => {
    expect(hoverKeyChanged<Hit>({ fixationIndex: 3 }, { fixationIndex: 3 }, byFixation)).toBe(false)
    expect(hoverKeyChanged<Hit>({ fixationIndex: null }, { fixationIndex: null }, byFixation)).toBe(false)
    expect(hoverKeyChanged<Hit>(null, null, byFixation)).toBe(false)
  })

  it('fires when the key changes', () => {
    expect(hoverKeyChanged<Hit>({ fixationIndex: 3 }, { fixationIndex: 4 }, byFixation)).toBe(true)
    expect(hoverKeyChanged<Hit>({ fixationIndex: 3 }, { fixationIndex: null }, byFixation)).toBe(true)
  })

  it('keys on the payload itself without a hoverKey', () => {
    const hit = { fixationIndex: 1 }
    expect(hoverKeyChanged<Hit>(hit, hit)).toBe(false)
    expect(hoverKeyChanged<Hit>(hit, { fixationIndex: 1 })).toBe(true)
    expect(hoverKeyChanged<Hit>(hit, null)).toBe(true)
  })
})
