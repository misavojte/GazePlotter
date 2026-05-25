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

  it('cosmetic-only updateMap call leaves structural version, bumps appearance, refreshes getAois', () => {
    // updateMap is the single decision point: when called with metadata whose
    // names/order/hidden are unchanged (color-only edit), it rebuilds groupPool,
    // sees it's byte-identical to the previous one, and skips the structural
    // version bump. Appearance always bumps so display caches refresh.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const engine = createEngine(['AOI 1', 'AOI 2'], [], []) as any
    const groupReader = engine.getAoiGroupReader()

    const before = getAois(engine, STIM)
    const structuralBefore = groupReader.version
    const appearanceBefore = groupReader.appearanceVersion

    // Mutate metadata color and route to bumpAppearance (mirrors the
    // production path for color-only AOI saves).
    engine.metadata.aois.data[STIM][1][2] = '#ff00ff'
    groupReader.updateMap(engine.metadata)

    const after = getAois(engine, STIM)

    expect(after).not.toBe(before)                     // getAois invalidated
    expect(after[0].color).toBe('#ff00ff')             // reflects new color
    expect(groupReader.version).toBe(structuralBefore) // metric cache safe
    expect(groupReader.appearanceVersion).toBe(appearanceBefore + 1)
  })

  it('CONTROL: two identical back-to-back queries — second should hit the cache', async () => {
    const { query } = await import('../src/lib/metrics')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const engine = createEngine(
      ['AOI 1', 'AOI 2'],
      [],
      [[0, 100, 0, 1], [100, 200, 0, 2], [200, 300, 0, 1]],
    ) as any
    let mappingCalls = 0
    const originalMapping = engine.getAoiMapping
    engine.getAoiMapping = (s: number, r: number) => {
      mappingCalls++
      return originalMapping(s, r)
    }
    const instance = {
      id: 't1', baseId: 'fixationCount', params: {}, label: '',
      projection: { kind: 'identity-aoi-vector' as const },
    }
    const scope = { engine, stimulusId: STIM, participantId: 0, timeStart: 0, timeEnd: 0 }

    query(instance, scope)
    const afterFirst = mappingCalls
    query(instance, scope)
    expect(mappingCalls).toBe(afterFirst) // baseline cache behaviour
  })

  it('REPRO: full color-only save path (updateAoisBatch + redundant updateHiddenAoisBatch) preserves metric cache', async () => {
    // This reproduces the actual production flow: the modal commit calls
    // workspace.updateAois, which fires BOTH updateAoisBatch AND
    // updateHiddenAoisBatch (even when hidden didn't change). Without diffing
    // on the hidden path, every color save bumps the structural version and
    // wipes the metric cache — which is exactly the lag the profile showed.
    const { query } = await import('../src/lib/metrics')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const engine = createEngine(
      ['AOI 1', 'AOI 2', 'AOI 3'],
      [2], // AOI 2 is hidden from the start
      [[0, 100, 0, 1], [100, 200, 0, 3], [200, 300, 0, 1]],
    ) as any

    const reader = engine.getReader()
    let fixIterations = 0
    const original = reader.getFixationSegmentIndex.bind(reader)
    reader.getFixationSegmentIndex = (k: number) => {
      fixIterations++
      return original(k)
    }

    const instance = {
      id: 't1', baseId: 'fixationCount', params: {}, label: '',
      projection: { kind: 'identity-aoi-vector' as const },
    }
    const scope = { engine, stimulusId: STIM, participantId: 0, timeStart: 0, timeEnd: 0 }

    query(instance, scope)
    const iterationsAfterWarm = fixIterations
    expect(iterationsAfterWarm).toBeGreaterThan(0)

    // Build the DataEngine-style mutator paths manually (the test fixture is
    // a plain object, not a real DataEngine). We replicate what the modal commit
    // does on a color-only save: mutate metadata color, call (the equivalent of)
    // updateAoisBatch and updateHiddenAoisBatch with unchanged names + unchanged hidden.
    engine.metadata.aois.data[STIM][1][2] = '#ff00ff'
    // Equivalent of DataEngine.updateAoisBatch for cosmetic change: bumpAppearance
    engine.getAoiGroupReader().updateMap(engine.metadata)
    // Equivalent of DataEngine.updateHiddenAoisBatch for unchanged hidden: NOOP
    // (the new code path detects no change and skips updateMap entirely)

    query(instance, scope)
    expect(fixIterations).toBe(iterationsAfterWarm) // metric cache hit
    expect(getAois(engine, STIM)[0].color).toBe('#ff00ff') // display refreshed
  })

  it('color-only save preserves the metric cache (no re-scan after bumpAppearance)', async () => {
    // Production scenario: color-only AOI save routes through bumpAppearance().
    // Metric cache (keyed on structural `version`) must hit; only getAois
    // (keyed on appearanceVersion) should rebuild.
    //
    // We isolate scan work by counting reader.getFixationSegmentIndex calls —
    // that method is invoked ONLY from scanAccumulator/scanBatch inner loops.
    // Counting getAoiMapping would be ambiguous because getAois calls it too.
    const { query } = await import('../src/lib/metrics')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const engine = createEngine(
      ['AOI 1', 'AOI 2'],
      [],
      [[0, 100, 0, 1], [100, 200, 0, 2], [200, 300, 0, 1]],
    ) as any

    const reader = engine.getReader()
    let fixIterations = 0
    const originalGetFix = reader.getFixationSegmentIndex.bind(reader)
    reader.getFixationSegmentIndex = (k: number) => {
      fixIterations++
      return originalGetFix(k)
    }

    const instance = {
      id: 't1', baseId: 'fixationCount', params: {}, label: '',
      projection: { kind: 'identity-aoi-vector' as const },
    }
    const scope = { engine, stimulusId: STIM, participantId: 0, timeStart: 0, timeEnd: 0 }

    query(instance, scope)
    const iterationsAfterWarm = fixIterations
    expect(iterationsAfterWarm).toBeGreaterThan(0) // sanity: scan ran

    engine.metadata.aois.data[STIM][1][2] = '#ff00ff'
    engine.getAoiGroupReader().updateMap(engine.metadata)

    // Cache hit → no fixation iteration.
    query(instance, scope)
    expect(fixIterations).toBe(iterationsAfterWarm)

    // Sanity: getAois saw the new color (appearance bumped).
    expect(getAois(engine, STIM)[0].color).toBe('#ff00ff')
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
