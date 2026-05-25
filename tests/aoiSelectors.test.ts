/**
 * Regression tests for the `getAois` memoization layer.
 *
 * Hot path: every metric query calls `buildAoiSlots` → `getAois`, which used
 * to rebuild the full displayed-AOI list (order vector → hidden filter →
 * mapping → Set dedupe → N× getAoiRaw) on every call. Profile showed this at
 * ~28% of total time. Memoization keyed by (reader, stim, aoiGroupReader.version)
 * collapses repeat calls to O(1).
 *
 * These tests verify:
 *  - Same (reader, stim, version) returns the same array reference.
 *  - A version bump (via AoiGroupReader.updateMap) invalidates the entry.
 *  - Grouped AOIs (shared display name) still deduplicate to one entry.
 *  - The returned array is frozen — callers can't corrupt the cache.
 */

import { describe, it, expect } from 'vitest'
import { createReaderFromJson } from '../src/lib/data/binary/converters'
import { AoiGroupReader } from '../src/lib/data/binary/reader.aoiGroup'
import { getAois } from '../src/lib/data/engine/selectors/aoiSelectors'

function createEngine(
  aoiNames: string[],
  hiddenRawIds: number[],
  segmentsForPid: number[][],
) {
  const aoiData: (string[] | null)[] = [null]
  const order: number[] = []
  for (let i = 0; i < aoiNames.length; i++) {
    aoiData.push([aoiNames[i], aoiNames[i], '#000000'])
    order.push(i + 1)
  }
  const segments: number[][][][] = [[], [segmentsForPid]]
  const reader = createReaderFromJson(segments)

  const metadata = {
    isOrdinalOnly: false,
    capabilities: { segmented: true, spatial: false, event: false },
    aois: {
      data: [[], aoiData],
      orderVector: [[], order],
      hiddenAois: [[], hiddenRawIds],
    },
    categories: { data: [['Fixation', 'Fixation', '#000000']], orderVector: [] },
    participants: { data: [['P0', 'P0']], orderVector: [] },
    participantsGroups: [],
    stimuli: { data: [['S0', 'S0'], ['S1', 'S1']], orderVector: [] },
    noAoiTreatment: { displayedName: 'Outside', color: 'gray' },
    metricInstances: [],
  }

  const aoiGroupReader = new AoiGroupReader(reader)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aoiGroupReader.updateMap(metadata as any)

  return {
    metadata,
    getReader: () => reader,
    getAoiGroupReader: () => aoiGroupReader,
    getAoiMapping: (sId: number, rawId: number) =>
      aoiGroupReader.getAoiMapping(sId, rawId),
  }
}

const STIM = 1

describe('getAois — memoization', () => {
  it('returns the same array reference for repeat calls with unchanged state', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const engine = createEngine(['AOI 1', 'AOI 2', 'AOI 3'], [], []) as any
    const a = getAois(engine, STIM)
    const b = getAois(engine, STIM)
    expect(a).toBe(b) // referential equality — cache hit
    expect(a.length).toBe(3)
  })

  it('returns a new array after AoiGroupReader.updateMap bumps the version', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const engine = createEngine(['AOI 1', 'AOI 2', 'AOI 3'], [], []) as any
    const before = getAois(engine, STIM)
    expect(before.length).toBe(3)

    // Mutate metadata to hide AOI 2 and re-run updateMap — production path for
    // visibility toggles (DataEngine.updateHiddenAoisBatch).
    engine.metadata.aois.hiddenAois = [[], [2]]
    engine.getAoiGroupReader().updateMap(engine.metadata)

    const after = getAois(engine, STIM)
    expect(after).not.toBe(before) // cache invalidated by version bump
    expect(after.length).toBe(2)
    expect(after.map(a => a.displayedName)).toEqual(['AOI 1', 'AOI 3'])
  })

  it('deduplicates AOIs that share a display name (real grouping)', () => {
    // raws 1, 2, 3, 4 with names ["Logo", "Logo", "Button", "Button"]:
    // AoiGroupReader.updateMap maps raw 2 → 1's rep, raw 4 → 3's rep.
    // getAois should return exactly 2 entries (one per name group), not 4.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const engine = createEngine(
      ['Logo', 'Logo', 'Button', 'Button'],
      [],
      [],
    ) as any
    const list = getAois(engine, STIM)
    expect(list.length).toBe(2)
    expect(list.map(a => a.displayedName).sort()).toEqual(['Button', 'Logo'])
  })

  it('cosmetic edit (bumpAppearance) refreshes getAois without bumping structural version', () => {
    // Simulates DataEngine.updateAoisBatch routing a color-only change to
    // bumpAppearance() instead of updateMap(). The metric cache (which keys
    // on the structural `version`) must stay valid; the getAois cache (which
    // keys on `appearanceVersion`) must invalidate.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const engine = createEngine(['AOI 1', 'AOI 2'], [], []) as any
    const groupReader = engine.getAoiGroupReader()

    const before = getAois(engine, STIM)
    const structuralBefore = groupReader.version
    const appearanceBefore = groupReader.appearanceVersion

    // Mutate metadata color and route to bumpAppearance (mirrors the
    // production path for color-only AOI saves).
    engine.metadata.aois.data[STIM][1][2] = '#ff00ff'
    groupReader.bumpAppearance()

    const after = getAois(engine, STIM)

    expect(after).not.toBe(before)                     // getAois invalidated
    expect(after[0].color).toBe('#ff00ff')             // reflects new color
    expect(groupReader.version).toBe(structuralBefore) // metric cache safe
    expect(groupReader.appearanceVersion).toBe(appearanceBefore + 1)
  })

  it('returned array is frozen — mutation attempts throw in strict mode', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const engine = createEngine(['AOI 1', 'AOI 2'], [], []) as any
    const list = getAois(engine, STIM)
    expect(Object.isFrozen(list)).toBe(true)
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(list as any).push({ id: 99 })
    }).toThrow()
  })
})
