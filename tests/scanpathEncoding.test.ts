/**
 * Displayed-name grouping through the scanpath encoder.
 *
 * Two raw AOIs sharing a displayed name are ONE logical AOI everywhere, so
 * they must encode to the same letter and fold under `collapsed`. Uses
 * `makeGroupedAoiEngine`, which wires the real AoiGroupReader, so group
 * representative resolution is exercised rather than stubbed — the fixture in
 * `plotTimeRangeBoundary.test.ts` uses distinct AOIs and never reaches it.
 *
 * The last case pins `collectAllScanpaths`'s shared letter index against the
 * per-call one built by `collectScanpath`.
 */
import { describe, it, expect } from 'vitest'
import { makeGroupedAoiEngine } from './helpers/testEngine'
import { getAois } from '../src/lib/data/engine/selectors/aoiSelectors'
import {
  collectAllScanpaths,
  collectScanpath,
} from '../src/lib/metrics/core/scanpathEncoding'

const STIM = 1

// raw 1 and raw 2 both display as 'Logo', so raw 2 resolves to raw 1's
// representative; raw 3 ('Button') is its own group. Segment rows are
// [start, end, category, ...rawAoiIds], category 0 = fixation.
function groupedEngine() {
  return makeGroupedAoiEngine(
    ['Logo', 'Logo', 'Button'],
    [
      [0, 50, 0, 1],
      [100, 150, 0, 2],
      [200, 250, 0, 3],
    ]
  )
}

describe('collectScanpath — displayed-name grouping', () => {
  it('same-name raw AOIs encode to the same letter', () => {
    const engine = groupedEngine()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aois = getAois(engine as any, STIM)
    expect(aois.map(a => a.displayedName)).toEqual(['Logo', 'Button'])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(collectScanpath(engine as any, STIM, 0, aois, false)).toBe('AAB')
  })

  it('collapse folds a run that spans the group boundary', () => {
    const engine = groupedEngine()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aois = getAois(engine as any, STIM)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(collectScanpath(engine as any, STIM, 0, aois, true)).toBe('AB')
  })

  it('collectAllScanpaths matches per-participant collectScanpath', () => {
    const engine = groupedEngine()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aois = getAois(engine as any, STIM)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [entry] = collectAllScanpaths(engine as any, STIM, [0], aois, false)
    expect(entry.scanpath).toBe(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      collectScanpath(engine as any, STIM, 0, aois, false)
    )
  })
})
