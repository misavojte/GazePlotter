import { describe, it, expect } from 'vitest'
import { runMigrations } from '../src/lib/data/ingest/workspace/migrations'
import {
  createSystemMetricInstances,
  createDefaultWindowedInstances,
  createDefaultAoiPairInstances,
  resolveInstance,
  type MetricInstance,
} from '../src/lib/metrics/instances'

function buildV5File(overrides: {
  enabledMetrics?: unknown
  extraSettings?: Record<string, unknown>
}): Record<string, unknown> {
  return {
    version: 5,
    data: {
      stimuli: { data: [['S1']], orderVector: [0] },
      participants: { data: [['P1']], orderVector: [0] },
      participantsGroups: [],
      categories: { data: [], orderVector: [] },
      aois: {
        data: [[]],
        orderVector: [[]],
        hiddenAois: [],
        dynamicVisibility: {},
      },
      eventData: {
        data: [[]],
        orderVector: [[]],
        hiddenChannels: [[]],
        events: [[]],
      },
      capabilities: { segmented: true, spatial: false, event: false },
      noAoiTreatment: { color: '#cbd5e1', displayedName: 'No AOI' },
      isOrdinalOnly: false,
    },
    gridItems: [
      {
        id: 'mc-1',
        type: 'metricCorrelation',
        x: 0,
        y: 0,
        w: 13,
        h: 13,
        settings: {
          stimulusId: 0,
          groupId: -1,
          view: 'heatmap',
          selectedAoiId: null,
          correlationMethod: 'spearman',
          enabledMetrics: overrides.enabledMetrics,
          ...(overrides.extraSettings ?? {}),
        },
      },
    ],
    fileMetadata: null,
  }
}

describe('V5 → V8 metric-instance migration', () => {
  it('seeds metricInstances on metadata when missing', () => {
    const file = buildV5File({ enabledMetrics: [] })
    const migrated = runMigrations(file)

    expect(migrated.version).toBe(11)
    const seeded = migrated.data.metricInstances
    expect(Array.isArray(seeded)).toBe(true)
    const expectedCount =
      createSystemMetricInstances().length +
      createDefaultWindowedInstances().length +
      createDefaultAoiPairInstances().length
    expect(seeded.length).toBe(expectedCount)
    // No more `system` marker — all instances are equally user-owned.
    for (const inst of seeded) expect(inst.system).toBeUndefined()
  })

  it('preserves an existing metricInstances array and adds seeded defaults', () => {
    const file = buildV5File({ enabledMetrics: [] })
    ;(file.data as any).metricInstances = [
      { id: 1, baseId: 'absoluteTime', params: {}, label: 'Renamed', system: true },
    ]

    const migrated = runMigrations(file)

    const windowed = createDefaultWindowedInstances()
    const pairs = createDefaultAoiPairInstances()
    // V9 → V10 fills in the identity projection for the pre-existing bare instance;
    // V10 → V11 strips the `system` marker.
    expect(migrated.data.metricInstances).toEqual([
      { id: 1, baseId: 'absoluteTime', params: {}, label: 'Renamed', projection: { kind: 'identity-aoi-vector' } },
      ...windowed,
      ...pairs,
    ])
  })

  it('expands empty enabledMetrics to every system id (old "all" semantics)', () => {
    const file = buildV5File({ enabledMetrics: [] })
    const migrated = runMigrations(file)

    const mc = migrated.gridItems[0]
    expect(mc.settings.enabledMetricIds).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(mc.settings.enabledMetrics).toBeUndefined()
  })

  it('translates specific enabledMetrics ids to instance ids', () => {
    const file = buildV5File({
      enabledMetrics: ['fixationCount' as any, 'absoluteTime', 'avgDwellDuration'],
    })
    const migrated = runMigrations(file)

    // 'absoluteTime' = 1, 'avgDwellDuration' = 4 (registry order).
    expect(migrated.gridItems[0].settings.enabledMetricIds).toEqual([1, 4])
  })

  it('skips migration when enabledMetricIds already present', () => {
    const file = buildV5File({
      enabledMetrics: ['absoluteTime'],
      extraSettings: { enabledMetricIds: [3, 5] },
    })
    const migrated = runMigrations(file)

    expect(migrated.gridItems[0].settings.enabledMetricIds).toEqual([3, 5])
  })

  it('leaves non-metricCorrelation grid items untouched by enabledMetrics logic', () => {
    const file = buildV5File({ enabledMetrics: [] })
    file.gridItems = [
      ...(file.gridItems as any[]),
      {
        id: 'bar-1',
        type: 'barPlot',
        x: 0,
        y: 0,
        w: 8,
        h: 8,
        settings: { aggregationMethod: 'absoluteTime', stimulusId: 0 },
      },
    ]

    const migrated = runMigrations(file)
    const bar = migrated.gridItems.find((g: any) => g.type === 'barPlot')
    // V8→V9 migrates aggregationMethod → metricInstanceId; enabledMetrics logic
    // does not touch bar-plot settings.
    expect(bar.settings.enabledMetricIds).toBeUndefined()
    expect(bar.settings.aggregationMethod).toBeUndefined()
    expect(bar.settings.metricInstanceId).toBe(1)
  })
})

describe('createDefaultAoiPairInstances — curated 5-instance pre-seeded library', () => {
  it('emits exactly 5 instances: count × {fix, visit}, probability fix, dwellMean × {fix, visit}', () => {
    const pairs = createDefaultAoiPairInstances()
    expect(pairs).toHaveLength(5)
    expect(pairs.map(p => ({ id: p.id, baseId: p.baseId, params: p.params }))).toEqual([
      { id: 50, baseId: 'transitionCount',        params: { mode: 'fixation' } },
      { id: 51, baseId: 'transitionCount',        params: { mode: 'visit' } },
      { id: 52, baseId: 'transitionProbability',  params: { mode: 'fixation', step: 1 } },
      { id: 53, baseId: 'transitionDwellMean',    params: { mode: 'fixation' } },
      { id: 54, baseId: 'transitionDwellMean',    params: { mode: 'visit' } },
    ])
  })

  it('gives every pre-seeded pair instance a descriptive label', () => {
    const byId = new Map(createDefaultAoiPairInstances().map(p => [p.id, p.label]))
    expect(byId.get(50)).toBe('Transition count (fixation pairs)')
    expect(byId.get(51)).toBe('Transition count (visit changes)')
    expect(byId.get(52)).toBe('Transition probability (fixation, 1-step)')
    expect(byId.get(53)).toBe('Mean transition dwell time (fixation pairs)')
    expect(byId.get(54)).toBe('Mean transition dwell time (visit changes)')
  })

})

describe('V7 → V8 transition-matrix settings migration', () => {
  function buildV7TransitionMatrixFile(aggregationMethod: string): Record<string, unknown> {
    return {
      version: 7,
      data: {
        stimuli: { data: [['S1']], orderVector: [0] },
        participants: { data: [['P1']], orderVector: [0] },
        participantsGroups: [],
        categories: { data: [], orderVector: [] },
        aois: { data: [[]], orderVector: [[]], hiddenAois: [], dynamicVisibility: {} },
        eventData: { data: [[]], orderVector: [[]], hiddenChannels: [[]], events: [[]] },
        capabilities: { segmented: true, spatial: false, event: false },
        noAoiTreatment: { color: '#cbd5e1', displayedName: 'No AOI' },
        isOrdinalOnly: false,
        metricInstances: [],
      },
      gridItems: [
        {
          id: 'tm-1',
          type: 'transitionMatrix',
          x: 0, y: 0, w: 12, h: 12,
          settings: { stimulusId: 0, groupId: -1, aggregationMethod, colorScale: [] },
        },
      ],
      fileMetadata: null,
    }
  }

  it('drops aggregationMethod + old display/step fields on migrated settings', () => {
    const m = runMigrations(buildV7TransitionMatrixFile('sum'))
    expect(m.version).toBe(11)
    const s = m.gridItems[0].settings
    expect(s.aggregationMethod).toBeUndefined()
    expect(s.display).toBeUndefined()
    expect(s.probabilityStep).toBeUndefined()
  })

  it('sum → metricInstanceId = 50 (transitionCount fixation)', () => {
    const s = runMigrations(buildV7TransitionMatrixFile('sum')).gridItems[0].settings
    expect(s.metricInstanceId).toBe(50)
  })

  it('probability → metricInstanceId = 52 (pre-seeded transitionProbability fix step=1)', () => {
    const s = runMigrations(buildV7TransitionMatrixFile('probability')).gridItems[0].settings
    expect(s.metricInstanceId).toBe(52)
  })

  it('dwellTime → metricInstanceId = 53 (transitionDwellMean fix)', () => {
    const s = runMigrations(buildV7TransitionMatrixFile('dwellTime')).gridItems[0].settings
    expect(s.metricInstanceId).toBe(53)
  })

  it('segmentDwellTime → metricInstanceId = 54 (transitionDwellMean visit)', () => {
    const s = runMigrations(buildV7TransitionMatrixFile('segmentDwellTime')).gridItems[0].settings
    expect(s.metricInstanceId).toBe(54)
  })

  it('frequencyRelative → creates custom transitionRelativeFrequency instance', () => {
    const m = runMigrations(buildV7TransitionMatrixFile('frequencyRelative'))
    const id = m.gridItems[0].settings.metricInstanceId
    // Custom ids live in the 1000+ range (nextInstanceId / SYSTEM_ID_OFFSET).
    expect(id).toBeGreaterThanOrEqual(1000)
    const created = m.data.metricInstances.find((i: any) => i.id === id)
    expect(created).toBeDefined()
    expect(created.baseId).toBe('transitionRelativeFrequency')
    expect(created.params).toEqual({ mode: 'fixation' })
    // Not system: true — custom, user-deletable.
    expect(created.system).toBeUndefined()
  })

  it('probability2 / probability3 → custom transitionProbability instances with step 2/3', () => {
    for (const [method, step] of [['probability2', 2], ['probability3', 3]] as const) {
      const m = runMigrations(buildV7TransitionMatrixFile(method))
      const id = m.gridItems[0].settings.metricInstanceId
      expect(id).toBeGreaterThanOrEqual(1000)
      const created = m.data.metricInstances.find((i: any) => i.id === id)
      expect(created.baseId).toBe('transitionProbability')
      expect(created.params).toEqual({ mode: 'fixation', step })
    }
  })

  it('seeds aoi-pair defaults into metricInstances for transition-matrix projects', () => {
    const m = runMigrations(buildV7TransitionMatrixFile('sum'))
    const ids = (m.data.metricInstances as MetricInstance[]).map(i => i.id)
    for (const id of [50, 51, 52, 53, 54]) expect(ids).toContain(id)
  })
})

describe('V8 → V9 bar-plot settings migration', () => {
  function buildV8BarPlotFile(aggregationMethod: string | undefined): Record<string, unknown> {
    return {
      version: 8,
      data: {
        stimuli: { data: [['S1']], orderVector: [0] },
        participants: { data: [['P1']], orderVector: [0] },
        participantsGroups: [],
        categories: { data: [], orderVector: [] },
        aois: { data: [[]], orderVector: [[]], hiddenAois: [], dynamicVisibility: {} },
        eventData: { data: [[]], orderVector: [[]], hiddenChannels: [[]], events: [[]] },
        capabilities: { segmented: true, spatial: false, event: false },
        noAoiTreatment: { color: '#cbd5e1', displayedName: 'No AOI' },
        isOrdinalOnly: false,
        metricInstances: createSystemMetricInstances(),
      },
      gridItems: [
        {
          id: 'bar-1',
          type: 'barPlot',
          x: 0, y: 0, w: 8, h: 8,
          settings: {
            stimulusId: 0,
            groupId: -1,
            ...(aggregationMethod !== undefined ? { aggregationMethod } : {}),
          },
        },
      ],
      fileMetadata: null,
    }
  }

  const expectedIdFor: Record<string, number> = {
    absoluteTime:             1,
    relativeTime:             2,
    averageEntries:           3,
    avgDwellDuration:         4,
    averageFixationCount:     5,
    avgFixationDuration:      6,
    timeToFirstFixation:      7,
    avgFirstFixationDuration: 8,
  }

  it('bumps version to 9', () => {
    expect(runMigrations(buildV8BarPlotFile('absoluteTime')).version).toBe(11)
  })

  it('drops aggregationMethod from migrated settings', () => {
    const m = runMigrations(buildV8BarPlotFile('absoluteTime'))
    expect(m.gridItems[0].settings.aggregationMethod).toBeUndefined()
  })

  for (const [method, expectedId] of Object.entries(expectedIdFor)) {
    it(`${method} → metricInstanceId = ${expectedId}`, () => {
      const m = runMigrations(buildV8BarPlotFile(method))
      expect(m.gridItems[0].settings.metricInstanceId).toBe(expectedId)
    })
  }

  it('unknown aggregationMethod falls back to absoluteTime (id 1)', () => {
    const m = runMigrations(buildV8BarPlotFile('notARealMethod'))
    expect(m.gridItems[0].settings.metricInstanceId).toBe(1)
  })

  it('missing aggregationMethod falls back to absoluteTime (id 1)', () => {
    const m = runMigrations(buildV8BarPlotFile(undefined))
    expect(m.gridItems[0].settings.metricInstanceId).toBe(1)
  })

  it('leaves non-barPlot grid items untouched', () => {
    const file = buildV8BarPlotFile('absoluteTime')
    ;(file.gridItems as any[]).push({
      id: 'scarf-1',
      type: 'scarf',
      x: 0, y: 0, w: 6, h: 6,
      settings: { stimulusId: 0, timeline: 'absolute' },
    })
    const m = runMigrations(file)
    const scarf = m.gridItems.find((g: any) => g.type === 'scarf')
    expect(scarf.settings.metricInstanceId).toBeUndefined()
    expect(scarf.settings.aggregationMethod).toBeUndefined()
  })
})

describe('resolveInstance — direct lookup, no fallback', () => {
  const library: MetricInstance[] = [
    { id: 50,  baseId: 'transitionCount', params: { mode: 'fixation' }, label: 'TC fix',   projection: { kind: 'identity-aoi-pair-matrix' } },
    { id: 51,  baseId: 'transitionCount', params: { mode: 'visit' },    label: 'TC visit', projection: { kind: 'identity-aoi-pair-matrix' } },
    { id: 100, baseId: 'transitionCount', params: { mode: 'fixation' }, label: 'Custom',   projection: { kind: 'identity-aoi-pair-matrix' } },
  ]

  it('returns the direct instance when its id exists', () => {
    expect(resolveInstance(library, 100)?.id).toBe(100)
  })

  it('returns undefined when id is missing', () => {
    expect(resolveInstance(library, 999)).toBeUndefined()
  })

  it('returns undefined when id is null', () => {
    expect(resolveInstance(library, null)).toBeUndefined()
  })
})
