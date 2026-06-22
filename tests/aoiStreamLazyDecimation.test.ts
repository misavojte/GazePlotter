/**
 * aoi-stream lazy display-resolution decimation.
 *
 * The transformer never evaluates more than `maxColumns` windows. It honors the
 * configured step by drawing every Nth configured window (integer stride), so
 * each drawn bin is a real configured-step window. Asserts: (a) binCount is
 * capped; (b) decimated bins equal the full-resolution bins at the strided
 * indices; (c) a generous budget reproduces the full resolution exactly.
 */
import { describe, it, expect } from 'vitest'
import { createReaderFromJson } from '../src/lib/data/binary/converters'
import { getAoiStreamPlotData } from '../src/lib/plots/aoi-stream/core/transformer'
import type { MetricInstance } from '../src/lib/metrics'

const WINDOW = 1000
const STEP = 10 // fine step -> many windows
const SPAN = 10_000
const INST_ID = 'win-test'

function windowedInstance(): MetricInstance {
  return {
    id: INST_ID,
    baseId: 'absoluteTime',
    params: {},
    label: 'win',
    projection: { kind: 'windowed', window: { windowSize: WINDOW, stepSize: STEP }, inner: { kind: 'identity-aoi-vector' } },
  }
}

function createEngine() {
  // One participant, ~50 fixations alternating AOI A/B across the span.
  const segs: number[][] = []
  let t = 0
  for (let i = 0; t + 150 <= SPAN; i++) { segs.push([t, t + 150, 0, i % 2]); t += 170 }
  const reader = createReaderFromJson([[segs]])
  return {
    metadata: {
      isOrdinalOnly: false,
      capabilities: { segmented: true, spatial: false, event: false },
      aois: { data: [[['A', 'A', 'red'], ['B', 'B', 'blue']]], orderVector: [[]], hiddenAois: [[]] },
      categories: { data: [['Fixation', 'Fixation', '#000000']], orderVector: [] },
      participants: { data: [['P0', 'P0']], orderVector: [0] },
      participantsGroups: [],
      stimuli: { data: [['S0', 'S0']], orderVector: [0] },
      noAoiTreatment: { displayedName: 'Outside', color: 'gray' },
      metricInstances: [windowedInstance()],
    },
    getReader: () => reader,
    getAoiMapping: (_s: number, rawId: number) => rawId,
  } as any
}

const base = { stimulusId: 0, groupId: -1, metricInstanceIds: [INST_ID], timelineMin: 0, timelineMax: SPAN }

describe('aoi-stream lazy decimation', () => {
  it('caps binCount at maxColumns and draws real configured-step windows', () => {
    const engine = createEngine()
    const full = getAoiStreamPlotData(engine, { ...base, maxColumns: 100_000 }) // stride 1
    const decimated = getAoiStreamPlotData(engine, { ...base, maxColumns: 50 })

    const fullW = Math.floor((SPAN - WINDOW) / STEP) + 1
    expect(full.binCount).toBe(fullW) // ~901 configured windows
    expect(decimated.binCount).toBeLessThanOrEqual(50)
    expect(decimated.binCount).toBeGreaterThan(1)

    // Reported step is the on-screen bin spacing = stride × configured step.
    const stride = Math.ceil(fullW / 50)
    expect(decimated.stepSize).toBe(stride * STEP)

    // Each decimated bin is the full-resolution bin at the strided index.
    for (let s = 0; s < decimated.series.length; s++) {
      for (let i = 0; i < decimated.binCount; i++) {
        const fi = i * stride
        if (fi >= full.binCount) break
        expect(decimated.series[s].values[i]).toBeCloseTo(full.series[s].values[fi], 6)
      }
    }
  })

  it('a budget >= W reproduces full resolution exactly (stride 1)', () => {
    const engine = createEngine()
    const a = getAoiStreamPlotData(engine, { ...base, maxColumns: 100_000 })
    const b = getAoiStreamPlotData(engine, { ...base, maxColumns: 5000 }) // still >= ~901
    expect(b.binCount).toBe(a.binCount)
    expect(b.stepSize).toBe(STEP)
    for (let s = 0; s < a.series.length; s++)
      for (let i = 0; i < a.binCount; i++)
        expect(b.series[s].values[i]).toBeCloseTo(a.series[s].values[i], 6)
  })
})
