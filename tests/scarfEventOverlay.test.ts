import { describe, it, expect } from 'vitest'
import { createReaderFromJson } from '../src/lib/data/binary/converters'
import { AoiGroupReader } from '../src/lib/data/binary/reader.aoiGroup'
import { EventBufferReader, jsonEventsToBinary } from '../src/lib/data/binary/reader.event'
import { FIXATION_CATEGORY_ID } from '../src/lib/data/binary/schema'
import { getScarfData } from '../src/lib/plots/scarf/core/view'
import { OVERLAY_EVENT_STRIDE } from '../src/lib/plots/scarf/const'
import type { ScarfPlotSettings } from '../src/lib/plots/scarf/types'

// Direct coverage of the scarf transform's event-overlay flow (there was none):
// collect → clip → sort → merge → lane pack. Pins the invariants the compact/
// overlay layout work must NOT disturb — merge of touching intervals, point vs
// interval strips, and cross-channel eventZoneConcurrency (the seam-height driver).
// All expectations are hand-computed from the input.

const STIM = 1

/** events[stimulus][channel][participant] = flat [start, duration, ...]. */
function buildEngine(events: number[][][][], channels: string[]) {
  // One participant, one long fixation so the full-extent window is [0, 400].
  const reader = createReaderFromJson([[], [[[0, 400, FIXATION_CATEGORY_ID, 1]]]])
  const eventReader = new EventBufferReader(jsonEventsToBinary(events))
  const aoiData: (string[] | null)[] = [null, ['AOI 1', 'AOI 1', '#e41a1c']]
  const eventChannels = channels.map(name => [name, name, '#3366cc'])

  const metadata = {
    isOrdinalOnly: false,
    capabilities: { segmented: true, spatial: false, event: true },
    aois: { data: [[], aoiData], orderVector: [[], [1]], hiddenAois: [[], []] },
    categories: { data: [['Fixation', 'Fixation', '#000']], orderVector: [] },
    participants: { data: [['P0', 'P0']], orderVector: [] },
    participantsGroups: [],
    stimuli: { data: [['S0', 'S0'], ['S1', 'S1']], orderVector: [] },
    eventData: {
      data: [[], eventChannels],
      orderVector: [[], channels.map((_, i) => i)],
      hiddenChannels: [[], []],
    },
    noAoiTreatment: { displayedName: 'Outside', color: 'gray' },
    metricInstances: [],
  }
  const agr = new AoiGroupReader(reader)
  agr.updateMap(metadata as never)

  return {
    metadata,
    capabilities: { segmented: true, spatial: false, event: true },
    eventsPerStimulus: [false, true],
    getReader: () => reader,
    getAoiGroupReader: () => agr,
    getEventReader: () => eventReader,
    getAoiMapping: (s: number, r: number) => agr.getAoiMapping(s, r),
  } as never
}

const SETTINGS: ScarfPlotSettings = {
  stimulusId: STIM,
  groupId: -1,
  timeline: 'absolute',
  absoluteStimuliLimits: [],
  ordinalStimuliLimits: [],
  timelineStart: 0,
  timelineEnd: 0,
}

/** Flatten every event strip across buckets → {x, w, lane, isPoint}. */
function strips(data: { visualEventBuckets: Float32Array[] }) {
  const out: { x: number; w: number; lane: number; isPoint: number }[] = []
  for (const b of data.visualEventBuckets) {
    for (let i = 0; i < b.length; i += OVERLAY_EVENT_STRIDE) {
      out.push({ x: b[i], w: b[i + 2], lane: b[i + 3], isPoint: b[i + 4] })
    }
  }
  return out
}

describe('scarf event overlay (collect/sort/merge/lane)', () => {
  it('merges touching intervals within a channel into one strip', () => {
    // Channel A, participant 0: [0,100] then [100,50] (=[100,150]); touching
    // (100 <= 100) so they merge into a single [0,150] interval strip.
    const data = getScarfData(buildEngine([[], [[[0, 100, 100, 50]]]], ['A']), SETTINGS)!
    const s = strips(data)
    expect(s.length).toBe(1)
    expect(s[0].isPoint).toBe(0)
    expect(s[0].x).toBeCloseTo(0, 6) // 0 / 400
    expect(s[0].w).toBeCloseTo(150 / 400, 6)
    expect(data.eventZoneConcurrency).toBe(1)
  })

  it('keeps a point (zero-duration) event as a point strip', () => {
    const data = getScarfData(buildEngine([[], [[[300, 0]]]], ['A']), SETTINGS)!
    const s = strips(data)
    expect(s.length).toBe(1)
    expect(s[0].isPoint).toBe(1)
    expect(s[0].w).toBe(0)
    expect(s[0].x).toBeCloseTo(300 / 400, 6)
    expect(data.eventZoneConcurrency).toBe(1)
  })

  it('assigns concurrent events across channels to separate lanes (concurrency unchanged)', () => {
    // A: [0,100]->[0,100]; B: [50,100]->[50,150] (overlap => 2 lanes) + point @300.
    const data = getScarfData(
      buildEngine([[], [[[0, 100]], [[50, 100, 300, 0]]]], ['A', 'B']),
      SETTINGS
    )!
    const s = strips(data)
    // 3 strips total: A[0,100], B[50,150], B point@300.
    expect(s.length).toBe(3)
    expect(s.filter(x => x.isPoint === 1).length).toBe(1)
    expect(s.filter(x => x.isPoint === 0).length).toBe(2)
    // The two overlapping intervals occupy two different lanes.
    const intervalLanes = s.filter(x => x.isPoint === 0).map(x => x.lane).sort()
    expect(intervalLanes).toEqual([0, 1])
    // Max simultaneous events (the seam-height driver) is 2, not 3.
    expect(data.eventZoneConcurrency).toBe(2)
  })
})
