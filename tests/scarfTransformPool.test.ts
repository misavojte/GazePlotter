import { describe, it, expect } from 'vitest'
import { createReaderFromJson } from '../src/lib/data/binary/converters'
import { AoiGroupReader } from '../src/lib/data/binary/reader.aoiGroup'
import { FIXATION_CATEGORY_ID } from '../src/lib/data/binary/schema'
import { getScarfData } from '../src/lib/plots/scarf/core/view'
import {
  createScarfBufferPool,
  buildRectRowOffsets,
} from '../src/lib/plots/scarf/core/transformer'
import { RECT_STRIDE } from '../src/lib/plots/scarf/const'
import type { ScarfPlotSettings } from '../src/lib/plots/scarf/types'

// Guards the two throughput changes to the scarf transform:
//  1. the per-instance grow-buffer reuse pool (a re-derive with the pool must
//     produce byte-identical buffers to a fresh, unpooled derive), and
//  2. the inline per-row offset index (must equal the standalone
//     buildRectRowOffsets reference it replaced).
// A small hand-built engine drives the real transform (getScarfData → transform).

function buildEngine() {
  // 3 participants, mix of fixations (1 AOI, from 3 AOIs) and saccades. Times
  // ascending per participant. Row = [start, end, categoryId, ...aoiRawIds].
  const perP: number[][][] = [
    [
      [0, 100, FIXATION_CATEGORY_ID, 1],
      [100, 130, 1], // saccade
      [130, 260, FIXATION_CATEGORY_ID, 2],
      [260, 400, FIXATION_CATEGORY_ID, 3],
    ],
    [
      [0, 90, FIXATION_CATEGORY_ID, 2],
      [90, 210, FIXATION_CATEGORY_ID, 1],
    ],
    [
      [0, 50, FIXATION_CATEGORY_ID, 3],
      [50, 70, 1], // saccade
      [70, 300, FIXATION_CATEGORY_ID, 1],
      [300, 320, 1], // saccade
      [320, 500, FIXATION_CATEGORY_ID, 2],
    ],
  ]
  const reader = createReaderFromJson([[], perP])
  const aoiData: (string[] | null)[] = [
    null,
    ['AOI 1', 'AOI 1', '#e41a1c'],
    ['AOI 2', 'AOI 2', '#377eb8'],
    ['AOI 3', 'AOI 3', '#4daf4a'],
  ]
  const metadata = {
    isOrdinalOnly: false,
    capabilities: { segmented: true, spatial: false, event: false },
    aois: { data: [[], aoiData], orderVector: [[], [1, 2, 3]], hiddenAois: [[], []] },
    categories: {
      data: [
        ['Fixation', 'Fixation', '#000000'],
        ['Saccade', 'Saccade', '#cccccc'],
      ],
      orderVector: [],
    },
    participants: { data: [['P0', 'P0'], ['P1', 'P1'], ['P2', 'P2']], orderVector: [] },
    participantsGroups: [],
    stimuli: { data: [['S0', 'S0'], ['S1', 'S1']], orderVector: [] },
    noAoiTreatment: { displayedName: 'Outside', color: 'gray' },
    metricInstances: [],
  }
  const agr = new AoiGroupReader(reader)
  agr.updateMap(metadata as never)
  return {
    metadata,
    capabilities: { segmented: true, spatial: false, event: false },
    eventsPerStimulus: [],
    getReader: () => reader,
    getAoiGroupReader: () => agr,
    getAoiMapping: (s: number, r: number) => agr.getAoiMapping(s, r),
  } as never
}

const SETTINGS: ScarfPlotSettings = {
  stimulusId: 1,
  groupId: -1,
  timeline: 'absolute',
  absoluteStimuliLimits: [],
  ordinalStimuliLimits: [],
  timelineStart: 0,
  timelineEnd: 0,
}

const snapshot = (buckets: Float32Array[]) => buckets.map(b => Array.from(b))

describe('scarf transform: buffer pool + inline row offsets', () => {
  it('pooled derive is byte-identical to a fresh derive', () => {
    const engine = buildEngine()
    const fresh = getScarfData(engine, SETTINGS)! // no pool
    const pool = createScarfBufferPool()
    const pooled = getScarfData(engine, SETTINGS, pool)!

    expect(snapshot(pooled.visualRectBuckets)).toEqual(snapshot(fresh.visualRectBuckets))
    expect(snapshot(pooled.visualEventBuckets)).toEqual(snapshot(fresh.visualEventBuckets))
  })

  it('a second pooled derive (buffers reused) still produces correct data', () => {
    const engine = buildEngine()
    const fresh = snapshot(getScarfData(engine, SETTINGS)!.visualRectBuckets)
    const pool = createScarfBufferPool()
    getScarfData(engine, SETTINGS, pool) // 1st: allocates the pool
    const second = getScarfData(engine, SETTINGS, pool)! // 2nd: reuses (reset) buffers
    expect(snapshot(second.visualRectBuckets)).toEqual(fresh)
    // rowOffsets must also be correct after reuse
    const rows = second.participants.length
    expect(second.rectRowOffsets.map(o => Array.from(o))).toEqual(
      buildRectRowOffsets(second.visualRectBuckets, rows).map(o => Array.from(o))
    )
  })

  it('inline row offsets equal the buildRectRowOffsets reference', () => {
    const engine = buildEngine()
    const data = getScarfData(engine, SETTINGS)!
    const rows = data.participants.length
    const reference = buildRectRowOffsets(data.visualRectBuckets, rows)
    expect(data.rectRowOffsets.map(o => Array.from(o))).toEqual(
      reference.map(o => Array.from(o))
    )
    // Every bucket's row slices are non-decreasing and end at the segment count.
    for (let b = 0; b < data.rectRowOffsets.length; b++) {
      const off = data.rectRowOffsets[b]
      expect(off[0]).toBe(0)
      expect(off[rows]).toBe(data.visualRectBuckets[b].length / RECT_STRIDE)
      for (let r = 0; r < rows; r++) expect(off[r + 1]).toBeGreaterThanOrEqual(off[r])
    }
  })
})
