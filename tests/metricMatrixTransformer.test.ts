import { describe, it, expect } from 'vitest'
import { makeTestEngine, type TestEngineOptions } from './helpers/testEngine'
import { getMetricMatrixData } from '../src/lib/plots/metric-matrix/core/transformer'
import type {
  MetricMatrixData,
  MetricMatrixPlotSettings,
} from '../src/lib/plots/metric-matrix/types'
import {
  createDefaultMetricInstances,
  createMetricInstance,
  type MetricInstance,
} from '../src/lib/metrics/instances'
import { getMetric } from '../src/lib/metrics'

// Segment row = [start, end, categoryId, ...rawAoiIds]; category 0 = fixation.
type Seg = number[]
type StimulusSegments = Seg[][] // [participantId][segIdx]

/**
 * Engine for Metric Matrix tests: one AOI-name list per stimulus (raw ids 1..n),
 * the default metric library plus any extra hand-built instances. `segments`
 * is [stimulusId][participantId][segIdx]; `[]` for an absent recording.
 */
function makeMetricMatrixEngine(opts: {
  segments: StimulusSegments[]
  aoiNamesPerStimulus?: string[][]
  participants?: string[][]
  participantsSelections?: TestEngineOptions['participantsSelections']
  stimuli?: string[][]
  stimuliOrderVector?: number[]
  extraInstances?: MetricInstance[]
}) {
  const stimulusCount = opts.segments.length
  const aoiData: (string[] | null)[][] = []
  const aoiOrderVector: number[][] = []
  for (let s = 0; s < Math.max(stimulusCount, 1); s++) {
    const names = opts.aoiNamesPerStimulus?.[s] ?? ['AOI 1']
    const data: (string[] | null)[] = [null]
    const order: number[] = []
    names.forEach((n, i) => {
      data.push([n, n, '#000000'])
      order.push(i + 1)
    })
    aoiData.push(data)
    aoiOrderVector.push(order)
  }
  return makeTestEngine(opts.segments as number[][][][], {
    aoiData,
    aoiOrderVector,
    stimuli:
      opts.stimuli ??
      Array.from({ length: stimulusCount }, (_, i) => [`S${i}`, `S${i}`]),
    stimuliOrderVector:
      opts.stimuliOrderVector ??
      Array.from({ length: stimulusCount }, (_, i) => i),
    participants: opts.participants,
    participantsSelections: opts.participantsSelections,
    metricInstances: [
      ...createDefaultMetricInstances(),
      ...(opts.extraInstances ?? []),
    ],
  })
}

function settings(
  over: Partial<MetricMatrixPlotSettings> = {}
): MetricMatrixPlotSettings {
  return {
    groupId: -1,
    metricInstanceIds: ['fixationCount-any'],
    colorScale: ['#f7fbff', '#08306b'],
    scaleRange: [0, 0],
    ...over,
  }
}

function cellAt(data: MetricMatrixData, row: number, col: number) {
  const i = row * data.cols.length + col
  return { value: data.values[i], state: data.state[i] }
}

// ─── 1. Happy path ────────────────────────────────────────────────────────────

describe('Metric Matrix — happy path', () => {
  it('lays out participants × stimuli with correct scalar values', () => {
    const engine = makeMetricMatrixEngine({
      segments: [
        // S0
        [
          [[0, 100, 0, 1], [100, 200, 0, 1]], // p0: 2 fixations
          [[0, 100, 0, 1]], // p1: 1 fixation
        ],
        // S1
        [
          [[0, 100, 0, 1], [100, 200, 0, 1], [200, 300, 0, 1]], // p0: 3
          [[0, 100, 0, 1]], // p1: 1
        ],
      ],
      aoiNamesPerStimulus: [['AOI 1'], ['AOI 1']],
    })

    const data = getMetricMatrixData(engine as never, settings())

    expect(data.rows.map(r => r.label)).toEqual(['P0', 'P1'])
    expect(data.cols.map(c => c.label)).toEqual(['S0', 'S1'])
    expect(cellAt(data, 0, 0)).toEqual({ value: 2, state: null })
    expect(cellAt(data, 0, 1)).toEqual({ value: 3, state: null })
    expect(cellAt(data, 1, 0)).toEqual({ value: 1, state: null })
    expect(cellAt(data, 1, 1)).toEqual({ value: 1, state: null })
    // Fixation count (sample size) is carried per cell for the tooltip.
    expect(data.fixations[0]).toBe(2) // p0 × S0: 2 fixations behind the value
    expect(data.fixations[1]).toBe(3) // p0 × S1: 3
    expect(data.unit).toBe(getMetric('fixationCount')!.meta.unit)
    expect(data.noMetric).toBeUndefined()
    expect(data.empty).toBeUndefined()
  })
})

// ─── 2. Absent ──────────────────────────────────────────────────────────────

describe('Metric Matrix — absent recording', () => {
  it('classifies a cell with no segments as absent (NaN value)', () => {
    const engine = makeMetricMatrixEngine({
      segments: [
        [[], [[0, 100, 0, 1]]], // S0: p0 absent, p1 present
        [[[0, 100, 0, 1]], [[0, 100, 0, 1]]], // S1: both present
      ],
    })
    const data = getMetricMatrixData(engine as never, settings())
    const c = cellAt(data, 0, 0)
    expect(c.state).toBe('absent')
    expect(Number.isNaN(c.value)).toBe(true)
    expect(data.fixations[0]).toBe(-1) // no recording → no fixation count
  })
})

// ─── 3. No fixations ──────────────────────────────────────────────────────────

describe('Metric Matrix — recording present but no fixations', () => {
  it('classifies segments-without-fixations as no-fixations (NaN value)', () => {
    const engine = makeMetricMatrixEngine({
      segments: [
        [[[0, 100, 1, 1]], [[0, 100, 0, 1]]], // S0: p0 saccade-only (cat 1), p1 fixation
        [[[0, 100, 0, 1]], [[0, 100, 0, 1]]],
      ],
    })
    const data = getMetricMatrixData(engine as never, settings())
    const c = cellAt(data, 0, 0)
    expect(c.state).toBe('no-fixations')
    expect(Number.isNaN(c.value)).toBe(true)
    expect(data.fixations[0]).toBe(0) // present recording, zero fixations
    // The neighbouring fixation-bearing cell is a real value.
    expect(cellAt(data, 1, 0).state).toBeNull()
  })
})

// ─── 4. Metric-independence of the verdict ────────────────────────────────────

describe('Metric Matrix — metric-independent classification', () => {
  it('classifies absent / no-fixations identically under extensive and intensive metrics', () => {
    const engine = makeMetricMatrixEngine({
      segments: [
        // S0: p0 absent, p1 saccade-only (no fixations), p2 fixation
        [[], [[0, 100, 1, 1]], [[0, 100, 0, 1]]],
        [[[0, 100, 0, 1]], [[0, 100, 0, 1]], [[0, 100, 0, 1]]],
      ],
    })

    const extensive = getMetricMatrixData(
      engine as never,
      settings({ metricInstanceIds: ['fixationCount-any'] })
    )
    const intensive = getMetricMatrixData(
      engine as never,
      settings({ metricInstanceIds: ['fixationDuration-any'] })
    )

    // p0/S0 absent, p1/S0 no-fixations — identical under both metric classes.
    expect(cellAt(extensive, 0, 0).state).toBe('absent')
    expect(cellAt(intensive, 0, 0).state).toBe('absent')
    expect(cellAt(extensive, 1, 0).state).toBe('no-fixations')
    expect(cellAt(intensive, 1, 0).state).toBe('no-fixations')
  })
})

// ─── 5. Real 0 is a value, not NA (anchor-5 regression guard) ──────────────────

describe('Metric Matrix — a genuine 0 is a value', () => {
  it('keeps a finite 0 on an extensive, present, fixation-bearing recording as a value', () => {
    const engine = makeMetricMatrixEngine({
      segments: [
        [[[100, 100, 0, 1]], [[0, 100, 0, 1]]], // S0: p0 one zero-duration fixation
        [[[0, 100, 0, 1]], [[0, 100, 0, 1]]],
      ],
      aoiNamesPerStimulus: [['AOI 1'], ['AOI 1']],
    })

    // absoluteTime-any = Σ fixation durations = 0 (a real 0, not missing data).
    const data = getMetricMatrixData(
      engine as never,
      settings({ metricInstanceIds: ['absoluteTime-any'] })
    )
    const c = cellAt(data, 0, 0)
    expect(c.state).toBeNull()
    expect(c.value).toBe(0)

    // The same cell under fixationCount-any is a real 1 (present, one fixation).
    const counts = getMetricMatrixData(
      engine as never,
      settings({ metricInstanceIds: ['fixationCount-any'] })
    )
    expect(cellAt(counts, 0, 0)).toEqual({ value: 1, state: null })
  })
})

// ─── 6. AOI not present on a stimulus ──────────────────────────────────────────

describe('Metric Matrix — AOI absent from a stimulus', () => {
  it('classifies a pick-aoi instance as aoi-not-present where the AOI is undefined', () => {
    const pickAoi2 = createMetricInstance({
      id: 'pick-aoi2',
      baseId: 'fixationCount',
      projection: { kind: 'pick-aoi', aoiRef: { by: 'name', name: 'AOI 2' } },
    })!

    const engine = makeMetricMatrixEngine({
      segments: [
        [[[0, 100, 0, 1]], [[0, 100, 0, 1]]], // S0: only AOI 1 defined, fixation on it
        [[[0, 100, 0, 1]], [[0, 100, 0, 1]]], // S1: AOI 1 + AOI 2 defined, fixation on AOI 1
      ],
      aoiNamesPerStimulus: [['AOI 1'], ['AOI 1', 'AOI 2']],
      extraInstances: [pickAoi2],
    })

    const data = getMetricMatrixData(
      engine as never,
      settings({ metricInstanceIds: ['pick-aoi2'] })
    )

    // S0 has no "AOI 2" → benign not-applicable.
    expect(cellAt(data, 0, 0).state).toBe('aoi-not-present')
    // S1 has "AOI 2" but the participant never fixated it → a real 0, not NA.
    expect(cellAt(data, 0, 1)).toEqual({ value: 0, state: null })
  })
})

// ─── 7. noMetric + empty states ────────────────────────────────────────────────

describe('Metric Matrix — metric-missing and empty states', () => {
  it('flags noMetric when the id does not resolve', () => {
    const engine = makeMetricMatrixEngine({
      segments: [
        [[[0, 100, 0, 1]]],
        [[[0, 100, 0, 1]]],
      ],
    })
    const data = getMetricMatrixData(
      engine as never,
      settings({ metricInstanceIds: ['does-not-exist'] })
    )
    expect(data.noMetric).toBe(true)
    expect(data.rows).toEqual([])
  })

  it('reports no-rows for a group with no participants', () => {
    const engine = makeMetricMatrixEngine({
      segments: [
        [[[0, 100, 0, 1]], [[0, 100, 0, 1]]],
        [[[0, 100, 0, 1]], [[0, 100, 0, 1]]],
      ],
      participantsSelections: [{ id: 0, name: 'Empty', participantsIds: [] }],
    })
    const data = getMetricMatrixData(engine as never, settings({ groupId: 0 }))
    expect(data.empty).toBe('no-rows')
    expect(data.noMetric).toBeUndefined()
  })

  it('reports no-cols when there are no stimuli', () => {
    const engine = makeMetricMatrixEngine({
      segments: [
        [[[0, 100, 0, 1]], [[0, 100, 0, 1]]],
        [[[0, 100, 0, 1]], [[0, 100, 0, 1]]],
      ],
      stimuli: [],
      stimuliOrderVector: [],
    })
    const data = getMetricMatrixData(engine as never, settings())
    expect(data.empty).toBe('no-cols')
  })

  it('reports all-na when every cell is NA', () => {
    const engine = makeMetricMatrixEngine({
      segments: [
        [[], []], // S0: both absent
        [[], []], // S1: both absent
      ],
    })
    const data = getMetricMatrixData(engine as never, settings())
    expect(data.rows.length).toBe(2)
    expect(data.cols.length).toBe(2)
    expect(data.empty).toBe('all-na')
    expect(data.state.every(s => s !== null)).toBe(true)
  })
})

// ─── 8. Group -1 vs -2 row axis ─────────────────────────────────────────────────

describe('Metric Matrix — group row axis (union over stimuli)', () => {
  it('group -1 lists every participant; group -2 the union of non-empty across stimuli', () => {
    const engine = makeMetricMatrixEngine({
      segments: [
        // S0: p0 present, p1 absent, p2 absent
        [[[0, 100, 0, 1]], [], []],
        // S1: p0 absent, p1 present, p2 absent
        [[], [[0, 100, 0, 1]], []],
      ],
    })

    const all = getMetricMatrixData(engine as never, settings({ groupId: -1 }))
    expect(all.rows.map(r => r.id)).toEqual([0, 1, 2])

    const nonEmpty = getMetricMatrixData(engine as never, settings({ groupId: -2 }))
    // p2 is empty on every stimulus → excluded; p0 (from S0), p1 (from S1) kept.
    expect(nonEmpty.rows.map(r => r.id)).toEqual([0, 1])
    // Still a full grid with NA where the recording is absent.
    expect(cellAt(nonEmpty, 0, 1).state).toBe('absent') // p0 on S1
    expect(cellAt(nonEmpty, 1, 0).state).toBe('absent') // p1 on S0
    expect(cellAt(nonEmpty, 0, 0).state).toBeNull() // p0 on S0
    expect(cellAt(nonEmpty, 1, 1).state).toBeNull() // p1 on S1
  })

  it('group -2 keeps natural participant order regardless of which stimulus a participant first appears on', () => {
    // Regression guard: p0 is non-empty ONLY on the later stimulus, p1 ONLY on
    // the earlier one. A first-appearance-across-stimuli union would emit [p1, p0]
    // (reversed); rows must follow the natural order vector [p0, p1].
    const engine = makeMetricMatrixEngine({
      segments: [
        [[], [[0, 100, 0, 1]]], // S0: p0 absent, p1 present
        [[[0, 100, 0, 1]], []], // S1: p0 present, p1 absent
      ],
    })
    const data = getMetricMatrixData(engine as never, settings({ groupId: -2 }))
    expect(data.rows.map(r => r.id)).toEqual([0, 1])
  })
})

// ─── 9. Same displayed name → two disambiguated rows ────────────────────────────

describe('Metric Matrix — duplicate displayed names', () => {
  it('keeps one row per recording, disambiguating shared labels with the original name', () => {
    const engine = makeMetricMatrixEngine({
      segments: [
        [[[0, 100, 0, 1]], [[0, 100, 0, 1]]],
        [[[0, 100, 0, 1]], [[0, 100, 0, 1]]],
      ],
      participants: [
        ['orig0', 'Alice'],
        ['orig1', 'Alice'],
      ],
    })
    const data = getMetricMatrixData(engine as never, settings())
    expect(data.rows.length).toBe(2)
    expect(data.rows.map(r => r.label)).toEqual([
      'Alice (orig0)',
      'Alice (orig1)',
    ])
  })
})
