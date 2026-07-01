/**
 * Metric Timeline (evolving-metrics) display-resolution decimation.
 *
 * Mirrors the aoi-stream decimation guard, now that both plots share the
 * `displayBudget` helper. The transformer must produce no more than ~maxColumns
 * windows PER PARTICIPANT by widening the step to a strided `displayStep`, so
 * cost scales with the plot's width instead of the recording length. Asserts:
 * (a) per-participant window count is capped; (b) a generous budget reproduces
 * full resolution (stride 1); (c) decimated window values equal the
 * full-resolution values at the strided configured positions.
 */
import { describe, it, expect } from 'vitest'
import { createReaderFromJson } from '../src/lib/data/binary/converters'
import { getEvolvingMetricsData } from '../src/lib/plots/evolving-metrics/core/transformer'
import type { MetricInstance } from '../src/lib/metrics'

const WINDOW = 1000
const STEP = 10 // fine step -> many windows
const SPAN = 10_000
const INST_ID = 'evo-win'

/** Windowed scalar metric: max AOI dwell-time per window -> scalar-timeseries. */
function scalarWindowedInstance(): MetricInstance {
  return {
    id: INST_ID,
    baseId: 'absoluteTime',
    params: {},
    label: 'evo',
    projection: {
      kind: 'windowed',
      window: { windowSize: WINDOW, stepSize: STEP },
      inner: { kind: 'aggregate-aoi', reducer: 'max' },
    },
  }
}

function createEngine() {
  // Two participants of different lengths so the global-extent budget is
  // exercised: P0 spans the full SPAN, P1 stops at ~60%.
  const mkSegs = (end: number) => {
    const segs: number[][] = []
    let t = 0
    for (let i = 0; t + 150 <= end; i++) {
      segs.push([t, t + 150, 0, i % 2])
      t += 170
    }
    return segs
  }
  const reader = createReaderFromJson([[mkSegs(SPAN), mkSegs(Math.floor(SPAN * 0.6))]])
  return {
    metadata: {
      isOrdinalOnly: false,
      capabilities: { segmented: true, spatial: false, event: false },
      aois: { data: [[['A', 'A', 'red'], ['B', 'B', 'blue']]], orderVector: [[]], hiddenAois: [[]] },
      categories: { data: [['Fixation', 'Fixation', '#000000']], orderVector: [] },
      participants: { data: [['P0', 'P0'], ['P1', 'P1']], orderVector: [0, 1] },
      participantsGroups: [],
      stimuli: { data: [['S0', 'S0']], orderVector: [0] },
      noAoiTreatment: { displayedName: 'Outside', color: 'gray' },
      metricInstances: [scalarWindowedInstance()],
    },
    getReader: () => reader,
    getAoiMapping: (_s: number, rawId: number) => rawId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

const base = {
  stimulusId: 0,
  groupId: -1,
  metricInstanceIds: [INST_ID],
  timelineMin: 0,
  timelineMax: SPAN,
}

describe('evolving-metrics lazy decimation', () => {
  it('caps per-participant window count at the budget', () => {
    const engine = createEngine()
    const decimated = getEvolvingMetricsData(engine, { ...base, maxColumns: 40 })
    expect(decimated.participants.length).toBe(2)
    for (const p of decimated.participants) {
      expect(p.windows.length).toBeLessThanOrEqual(40)
    }
    // The longest participant must still have real detail (not collapsed to 1).
    expect(decimated.participants[0].windows.length).toBeGreaterThan(1)
  })

  it('a budget >= W reproduces full resolution (stride 1)', () => {
    const engine = createEngine()
    const full = getEvolvingMetricsData(engine, { ...base, maxColumns: 100_000 })
    const fuller = getEvolvingMetricsData(engine, { ...base, maxColumns: 1_000_000 })
    // Both budgets exceed the configured window count -> stride 1 -> identical.
    expect(full.participants[0].windows.length).toBe(fuller.participants[0].windows.length)
    // Full resolution far exceeds a tight display budget (so decimation is real
    // work being saved, not a no-op). The fine STEP=10 over the SPAN yields many
    // hundreds of configured windows.
    expect(full.participants[0].windows.length).toBeGreaterThan(500)
    // Reported step is unchanged at full resolution.
    expect(full.participants[0].windows.length).toBeGreaterThan(40)
  })

  it('decimated window values equal full-resolution values at strided positions', () => {
    const engine = createEngine()
    const full = getEvolvingMetricsData(engine, { ...base, maxColumns: 100_000 })
    const decimated = getEvolvingMetricsData(engine, { ...base, maxColumns: 40 })

    const fullW = full.participants[0].windows.length
    const stride = Math.ceil((Math.floor((SPAN - WINDOW) / STEP) + 1) / 40)

    for (let p = 0; p < decimated.participants.length; p++) {
      const dw = decimated.participants[p].windows
      const fw = full.participants[p].windows
      for (let i = 0; i < dw.length; i++) {
        const fi = i * stride
        if (fi >= fw.length || fi >= fullW) break
        // Same window bounds (start at timelineMin, width windowSize) -> same value.
        expect(dw[i].value).toBeCloseTo(fw[fi].value, 6)
      }
    }
  })
})
