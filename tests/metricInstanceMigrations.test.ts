import { describe, it, expect } from 'vitest'
import { runMigrations as runMigrationsTyped } from '../src/lib/data/ingest/workspace/migrations'
const runMigrations = runMigrationsTyped as (parsedJson: unknown) => any
import {
  createDefaultMetricInstances,
  resolveInstance,
  type MetricInstance,
} from '../src/lib/metrics/instances'
import { STARTING_METRICS } from '../src/lib/metrics/startingMetrics'
import { getRecipe } from '../src/lib/metrics/core/defineMetric'

// Reference starter count for seed assertions. Matches STARTING_METRICS length.
const STARTER_COUNT = STARTING_METRICS.length

type V4GridItem = Record<string, unknown> & {
  id: string
  type: string
  x: number
  y: number
  w: number
  h: number
  settings: Record<string, unknown>
}

function buildV4File(
  gridItems: V4GridItem[] = [],
  overrides: { dynamicVisibility?: Record<string, number[]> } = {},
): Record<string, unknown> {
  return {
    version: 4,
    data: {
      stimuli: { data: [['S1']], orderVector: [0] },
      participants: { data: [['P1']], orderVector: [0] },
      participantsSelections: [],
      categories: { data: [], orderVector: [] },
      aois: {
        data: [[]],
        orderVector: [[]],
        dynamicVisibility: overrides.dynamicVisibility ?? {},
      },
      capabilities: { segmented: true, spatial: false, event: false },
      noAoiTreatment: { color: '#cbd5e1', displayedName: 'No AOI' },
      isOrdinalOnly: false,
    },
    gridItems,
    fileMetadata: null,
  }
}

describe('V4 → V5 consolidated migration: metric-instance seeding', () => {
  it('seeds metricInstances with the slug-keyed starter library', () => {
    const migrated = runMigrations(buildV4File())

    expect(migrated.version).toBe(5)
    const seeded = migrated.data.metricInstances as MetricInstance[]
    expect(Array.isArray(seeded)).toBe(true)
    expect(seeded.length).toBe(STARTER_COUNT)
    for (const inst of seeded) {
      expect(typeof inst.id).toBe('string')
      // No `system` marker — every instance is equally user-owned.
      expect((inst as unknown as { system?: unknown }).system).toBeUndefined()
    }
    // Spot-check a few expected slugs.
    const ids = new Set(seeded.map(i => i.id))
    expect(ids.has('absoluteTime')).toBe(true)
    expect(ids.has('transitionCount-fix')).toBe(true)
    expect(ids.has('rqaDet')).toBe(true)
  })

  it('materializes eventData from legacy dynamicVisibility', () => {
    const migrated = runMigrations(buildV4File([]))
    // With an empty dynamicVisibility, eventData's top-level arrays exist
    // and are sized per-stimulus (1 stimulus in the fixture).
    const ed = migrated.data.eventData
    expect(Array.isArray(ed.data)).toBe(true)
    expect(ed.data.length).toBe(1)
    expect(Array.isArray(ed.events)).toBe(true)
  })
})

describe('V4 → V5 transition-matrix settings migration', () => {
  function buildTMFile(aggregationMethod: string): Record<string, unknown> {
    return buildV4File([
      {
        id: 'tm-1',
        type: 'transitionMatrix',
        x: 0,
        y: 0,
        w: 12,
        h: 12,
        settings: {
          stimulusId: 0,
          groupId: -1,
          aggregationMethod,
          colorScale: [],
        },
      },
    ])
  }

  it('bumps version to 5', () => {
    expect(runMigrations(buildTMFile('sum')).version).toBe(5)
  })

  it('drops aggregationMethod from migrated settings', () => {
    const s = runMigrations(buildTMFile('sum')).gridItems[0].settings
    expect(s.aggregationMethod).toBeUndefined()
  })

  it('sum → metricInstanceId = "transitionCount-fix"', () => {
    const s = runMigrations(buildTMFile('sum')).gridItems[0].settings
    expect(s.metricInstanceIds[0]).toBe('transitionCount-fix')
  })

  it('probability → metricInstanceId = "transitionProbability-fix"', () => {
    const s = runMigrations(buildTMFile('probability')).gridItems[0].settings
    expect(s.metricInstanceIds[0]).toBe('transitionProbability-fix')
  })

  it('dwellTime → metricInstanceId = "transitionDwellMean-fix"', () => {
    const s = runMigrations(buildTMFile('dwellTime')).gridItems[0].settings
    expect(s.metricInstanceIds[0]).toBe('transitionDwellMean-fix')
  })

  it('segmentDwellTime → metricInstanceId = "transitionDwellMean-visit"', () => {
    const s = runMigrations(buildTMFile('segmentDwellTime')).gridItems[0].settings
    expect(s.metricInstanceIds[0]).toBe('transitionDwellMean-visit')
  })

  it('frequencyRelative → creates custom transitionRelativeFrequency instance (UUID id)', () => {
    const m = runMigrations(buildTMFile('frequencyRelative'))
    const id = m.gridItems[0].settings.metricInstanceIds[0]
    expect(typeof id).toBe('string')
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    const created = (m.data.metricInstances as MetricInstance[]).find(i => i.id === id)
    expect(created).toBeDefined()
    expect(created!.baseId).toBe('transitionRelativeFrequency')
    expect(created!.params).toEqual({ mode: 'fixation' })
    expect((created as unknown as { system?: unknown }).system).toBeUndefined()
  })

  it('probability2 / probability3 → custom transitionProbability instances with step 2/3', () => {
    for (const [method, step] of [['probability2', 2], ['probability3', 3]] as const) {
      const m = runMigrations(buildTMFile(method))
      const id = m.gridItems[0].settings.metricInstanceIds[0]
      expect(typeof id).toBe('string')
      const created = (m.data.metricInstances as MetricInstance[]).find(i => i.id === id)
      expect(created).toBeDefined()
      expect(created!.baseId).toBe('transitionProbability')
      expect(created!.params).toEqual({ mode: 'fixation', step })
    }
  })

  it('unknown aggregationMethod falls back to "transitionCount-fix"', () => {
    const s = runMigrations(buildTMFile('notARealMethod')).gridItems[0].settings
    expect(s.metricInstanceIds[0]).toBe('transitionCount-fix')
  })

  it('all matrix starter slugs are present in seeded metricInstances', () => {
    const m = runMigrations(buildTMFile('sum'))
    const ids = (m.data.metricInstances as MetricInstance[]).map(i => i.id)
    for (const slug of [
      'transitionCount-fix',
      'transitionCount-visit',
      'transitionProbability-fix',
      'transitionDwellMean-fix',
      'transitionDwellMean-visit',
    ]) {
      expect(ids).toContain(slug)
    }
  })

  it('deduplicates repeated legacy custom methods across grid items', () => {
    const file = buildV4File([
      {
        id: 'tm-1',
        type: 'transitionMatrix',
        x: 0, y: 0, w: 12, h: 12,
        settings: { stimulusId: 0, groupId: -1, aggregationMethod: 'frequencyRelative', colorScale: [] },
      },
      {
        id: 'tm-2',
        type: 'transitionMatrix',
        x: 0, y: 12, w: 12, h: 12,
        settings: { stimulusId: 0, groupId: -1, aggregationMethod: 'frequencyRelative', colorScale: [] },
      },
    ])
    const m = runMigrations(file)
    const [id1, id2] = m.gridItems.map((g: any) => g.settings.metricInstanceIds[0])
    expect(id1).toBe(id2)
    // Only one custom instance should exist for that baseId+params.
    const instances = (m.data.metricInstances as MetricInstance[]).filter(
      i => i.baseId === 'transitionRelativeFrequency',
    )
    expect(instances).toHaveLength(1)
  })
})

describe('V4 → V5 bar-plot settings migration', () => {
  function buildBarFile(aggregationMethod: string | undefined): Record<string, unknown> {
    return buildV4File([
      {
        id: 'bar-1',
        type: 'barPlot',
        x: 0,
        y: 0,
        w: 8,
        h: 8,
        settings: {
          stimulusId: 0,
          groupId: -1,
          ...(aggregationMethod !== undefined ? { aggregationMethod } : {}),
        },
      },
    ])
  }

  const expectedSlugFor: Record<string, string> = {
    absoluteTime:             'absoluteTime',
    relativeTime:             'relativeTime',
    averageEntries:           'visitCount',
    avgDwellDuration:         'visitDuration',
    averageFixationCount:     'fixationCount',
    avgFixationDuration:      'fixationDuration',
    timeToFirstFixation:      'timeToFirstFixation',
    avgFirstFixationDuration: 'firstFixationDuration',
  }

  it('bumps version to 5', () => {
    expect(runMigrations(buildBarFile('absoluteTime')).version).toBe(5)
  })

  it('drops aggregationMethod from migrated settings', () => {
    const m = runMigrations(buildBarFile('absoluteTime'))
    expect(m.gridItems[0].settings.aggregationMethod).toBeUndefined()
  })

  for (const [method, expectedSlug] of Object.entries(expectedSlugFor)) {
    it(`${method} → metricInstanceId = "${expectedSlug}"`, () => {
      const m = runMigrations(buildBarFile(method))
      expect(m.gridItems[0].settings.metricInstanceIds[0]).toBe(expectedSlug)
    })
  }

  it('unknown aggregationMethod falls back to "absoluteTime"', () => {
    const m = runMigrations(buildBarFile('notARealMethod'))
    expect(m.gridItems[0].settings.metricInstanceIds[0]).toBe('absoluteTime')
  })

  it('missing aggregationMethod falls back to "absoluteTime"', () => {
    const m = runMigrations(buildBarFile(undefined))
    expect(m.gridItems[0].settings.metricInstanceIds[0]).toBe('absoluteTime')
  })

  it('leaves non-barPlot / non-transitionMatrix grid items untouched', () => {
    const file = buildV4File([
      {
        id: 'bar-1',
        type: 'barPlot',
        x: 0, y: 0, w: 8, h: 8,
        settings: { stimulusId: 0, groupId: -1, aggregationMethod: 'absoluteTime' },
      },
      {
        id: 'scarf-1',
        type: 'scarf',
        x: 0, y: 8, w: 6, h: 6,
        settings: { stimulusId: 0, timeline: 'absolute' },
      },
    ])
    const m = runMigrations(file)
    const scarf = m.gridItems.find((g: any) => g.type === 'scarf')
    expect(scarf.settings.metricInstanceIds).toBeUndefined()
    expect(scarf.settings.aggregationMethod).toBeUndefined()
  })

  it('initializes hideNoAoi to false when it is undefined on barPlot', () => {
    const file = buildV4File([
      {
        id: 'bar-1',
        type: 'barPlot',
        x: 0, y: 0, w: 8, h: 8,
        settings: { stimulusId: 0, groupId: -1, aggregationMethod: 'absoluteTime' },
      },
    ])
    const m = runMigrations(file)
    expect(m.gridItems[0].settings.hideNoAoi).toBe(false)
  })

  it('keeps hideNoAoi value if it is already defined', () => {
    const file = buildV4File([
      {
        id: 'bar-1',
        type: 'barPlot',
        x: 0, y: 0, w: 8, h: 8,
        settings: { stimulusId: 0, groupId: -1, aggregationMethod: 'absoluteTime', hideNoAoi: true },
      },
    ])
    const m = runMigrations(file)
    expect(m.gridItems[0].settings.hideNoAoi).toBe(true)
  })

  it('initializes hideNoAoi to false when it is undefined on aoiStreamPlot', () => {
    const file = buildV4File([
      {
        id: 'stream-1',
        type: 'aoiStreamPlot',
        x: 0, y: 0, w: 8, h: 8,
        settings: { stimulusId: 0, groupId: -1, binSize: 500 },
      },
    ])
    const m = runMigrations(file)
    expect(m.gridItems[0].settings.hideNoAoi).toBe(false)
  })

  it('keeps hideNoAoi value if it is already defined on aoiStreamPlot', () => {
    const file = buildV4File([
      {
        id: 'stream-1',
        type: 'aoiStreamPlot',
        x: 0, y: 0, w: 8, h: 8,
        settings: { stimulusId: 0, groupId: -1, binSize: 500, hideNoAoi: true },
      },
    ])
    const m = runMigrations(file)
    expect(m.gridItems[0].settings.hideNoAoi).toBe(true)
  })

  it('initializes hideNoAoi to false when it is undefined on transitionMatrix', () => {
    const file = buildV4File([
      {
        id: 'tm-1',
        type: 'transitionMatrix',
        x: 0, y: 0, w: 8, h: 8,
        settings: { stimulusId: 0, groupId: -1, aggregationMethod: 'sum' },
      },
    ])
    const m = runMigrations(file)
    expect(m.gridItems[0].settings.hideNoAoi).toBe(false)
  })

  it('keeps hideNoAoi value if it is already defined on transitionMatrix', () => {
    const file = buildV4File([
      {
        id: 'tm-1',
        type: 'transitionMatrix',
        x: 0, y: 0, w: 8, h: 8,
        settings: { stimulusId: 0, groupId: -1, aggregationMethod: 'sum', hideNoAoi: true },
      },
    ])
    const m = runMigrations(file)
    expect(m.gridItems[0].settings.hideNoAoi).toBe(true)
  })

  it('initializes hideNoAoi to false when it is undefined on scarf', () => {
    const file = buildV4File([
      {
        id: 'scarf-1',
        type: 'scarf',
        x: 0, y: 0, w: 8, h: 8,
        settings: { stimulusId: 0, groupId: -1 },
      },
    ])
    const m = runMigrations(file)
    expect(m.gridItems[0].settings.hideNoAoi).toBe(false)
  })

  it('keeps hideNoAoi value if it is already defined on scarf', () => {
    const file = buildV4File([
      {
        id: 'scarf-1',
        type: 'scarf',
        x: 0, y: 0, w: 8, h: 8,
        settings: { stimulusId: 0, groupId: -1, hideNoAoi: true },
      },
    ])
    const m = runMigrations(file)
    expect(m.gridItems[0].settings.hideNoAoi).toBe(true)
  })
})

describe('V4 → V5 aoi-stream binSize → metricInstanceIds migration', () => {
  function aoiStreamItems(binSizes: number[]): V4GridItem[] {
    return binSizes.map((binSize, idx) => ({
      id: `stream-${idx}`,
      type: 'aoiStreamPlot',
      x: 0,
      y: idx * 10,
      w: 12,
      h: 10,
      settings: { stimulusId: 0, groupId: -1, binSize, absoluteStimuliLimits: [] },
    }))
  }

  it('replaces binSize with metricInstanceIds → the matching starter slug', () => {
    const m = runMigrations(buildV4File(aoiStreamItems([500])))
    const item = m.gridItems[0]
    expect(item.settings.binSize).toBeUndefined()
    // binSize 500 reuses the seeded `absoluteTime-aoi-windowed-500` starter.
    expect(item.settings.metricInstanceIds).toEqual(['absoluteTime-aoi-windowed-500'])
  })

  it('reuses the matching starter for repeated binSizes (no duplicate minted)', () => {
    const m = runMigrations(buildV4File(aoiStreamItems([500, 500, 500])))
    const ids = m.gridItems.map((g: any) => g.settings.metricInstanceIds[0])
    expect(new Set(ids).size).toBe(1)
    const matches = (m.data.metricInstances as MetricInstance[]).filter(
      (i: any) => i.id === 'absoluteTime-aoi-windowed-500'
    )
    expect(matches).toHaveLength(1)
  })

  it('mints a distinct windowed instance for each non-starter binSize', () => {
    const m = runMigrations(buildV4File(aoiStreamItems([500, 1000, 250])))
    const ids = new Set<string>(
      m.gridItems.map((g: any) => g.settings.metricInstanceIds[0])
    )
    expect(ids).toEqual(
      new Set([
        'absoluteTime-aoi-windowed-500',
        'absoluteTime-aoi-windowed-1000',
        'absoluteTime-aoi-windowed-250',
      ])
    )
    const lib = new Set((m.data.metricInstances as MetricInstance[]).map(i => i.id))
    expect(lib.has('absoluteTime-aoi-windowed-1000')).toBe(true)
    expect(lib.has('absoluteTime-aoi-windowed-250')).toBe(true)
  })

  it('falls back to a 500 ms bin when binSize is missing', () => {
    const items: V4GridItem[] = [
      {
        id: 'stream-x',
        type: 'aoiStreamPlot',
        x: 0,
        y: 0,
        w: 12,
        h: 10,
        settings: { stimulusId: 0, groupId: -1, absoluteStimuliLimits: [] },
      },
    ]
    const m = runMigrations(buildV4File(items))
    expect(m.gridItems[0].settings.metricInstanceIds).toEqual([
      'absoluteTime-aoi-windowed-500',
    ])
  })

  it('skips an aoi-stream item that already carries a metricInstanceId', () => {
    const items: V4GridItem[] = [
      {
        id: 'stream-pre',
        type: 'aoiStreamPlot',
        x: 0,
        y: 0,
        w: 12,
        h: 10,
        settings: {
          stimulusId: 0,
          groupId: -1,
          metricInstanceId: 'pre-existing-slug',
          absoluteStimuliLimits: [],
        },
      },
    ]
    const m = runMigrations(buildV4File(items))
    // The binSize pass skips it; the normalization pass folds the singular id
    // into the canonical array.
    expect(m.gridItems[0].settings.metricInstanceIds).toEqual(['pre-existing-slug'])
    expect(m.gridItems[0].settings.binSize).toBeUndefined()
  })
})

describe('V4 → V5 metric-reference normalization to metricInstanceIds: string[]', () => {
  it('barPlot aggregationMethod is translated and folded into metricInstanceIds', () => {
    const m = runMigrations(buildV4File([{
      id: 'b', type: 'barPlot', x: 0, y: 0, w: 6, h: 6,
      settings: { stimulusId: 0, groupId: -1, aggregationMethod: 'averageEntries' },
    }]))
    const s = m.gridItems[0].settings
    expect(s.metricInstanceIds).toEqual(['visitCount'])
    expect(s.metricInstanceId).toBeUndefined()
    expect(s.aggregationMethod).toBeUndefined()
  })

  it('evolvingMetrics settings.selectedMetricId → metricInstanceIds: [id]', () => {
    const m = runMigrations(buildV4File([{
      id: 'e', type: 'evolvingMetrics', x: 0, y: 0, w: 6, h: 6,
      settings: { stimulusId: 0, groupId: -1, selectedMetricId: 'avgFixationDuration-any-windowed' },
    }]))
    const s = m.gridItems[0].settings
    expect(s.metricInstanceIds).toEqual(['avgFixationDuration-any-windowed'])
    expect(s.selectedMetricId).toBeUndefined()
  })

  it('evolvingMetrics settings.selectedMetricId === null → metricInstanceIds: []', () => {
    const m = runMigrations(buildV4File([{
      id: 'e', type: 'evolvingMetrics', x: 0, y: 0, w: 6, h: 6,
      settings: { stimulusId: 0, groupId: -1, selectedMetricId: null },
    }]))
    expect(m.gridItems[0].settings.metricInstanceIds).toEqual([])
  })

  it('metricCorrelation settings.enabledMetricIds → metricInstanceIds (rename only)', () => {
    const m = runMigrations(buildV4File([{
      id: 'mc', type: 'metricCorrelation', x: 0, y: 0, w: 6, h: 6,
      settings: { stimulusId: 0, groupId: -1, enabledMetricIds: ['rqaRec', 'rqaDet'] },
    }]))
    const s = m.gridItems[0].settings
    expect(s.metricInstanceIds).toEqual(['rqaRec', 'rqaDet'])
    expect(s.enabledMetricIds).toBeUndefined()
  })

  it('combines bar-plot translation and aoi-stream binSize migration end-to-end', () => {
    const m = runMigrations(buildV4File([
      {
        id: 'b', type: 'barPlot', x: 0, y: 0, w: 6, h: 6,
        settings: { stimulusId: 0, groupId: -1, aggregationMethod: 'averageEntries' },
      },
      {
        id: 'a', type: 'aoiStreamPlot', x: 0, y: 6, w: 12, h: 10,
        settings: { stimulusId: 0, groupId: -1, binSize: 500, absoluteStimuliLimits: [] },
      },
    ]))
    const bar = m.gridItems.find((g: any) => g.type === 'barPlot').settings
    const stream = m.gridItems.find((g: any) => g.type === 'aoiStreamPlot').settings
    expect(bar.metricInstanceIds).toEqual(['visitCount'])
    expect(stream.binSize).toBeUndefined()
    expect(stream.metricInstanceId).toBeUndefined()
    expect(stream.metricInstanceIds).toEqual(['absoluteTime-aoi-windowed-500'])
  })
})

describe('STARTING_METRICS — settings-file integrity', () => {
  it('has unique ids', () => {
    const ids = new Set(STARTING_METRICS.map(s => s.id))
    expect(ids.size).toBe(STARTING_METRICS.length)
  })

  it('every baseId resolves to a registered recipe', () => {
    for (const spec of STARTING_METRICS) {
      expect(getRecipe(spec.baseId), `starter "${spec.id}" baseId=${spec.baseId}`).toBeDefined()
    }
  })

  it('createDefaultMetricInstances builds the full starter set', () => {
    const instances = createDefaultMetricInstances()
    expect(instances.length).toBe(STARTING_METRICS.length)
    expect(instances.map(i => i.id)).toEqual(STARTING_METRICS.map(s => s.id))
  })

  it('windowed AOI starters (the AOI Timeline consumers) pin `sum` so the band is a cohort total, except the relativeTime share', () => {
    const byId = new Map(createDefaultMetricInstances().map(i => [i.id, i]))
    for (const slug of [
      'absoluteTime-aoi-windowed-500',
      'fixationCount-aoi-windowed-500',
      'visitCount-aoi-windowed-500',
    ]) {
      expect(byId.get(slug)?.reduction, slug).toBe('sum')
    }
    // relativeTime is already a per-participant share (intensive) — it stays
    // mean (no override), and `sum` is not in its sound set.
    expect(byId.get('relativeTime-aoi-windowed-500')?.reduction).toBeUndefined()
  })

  it('matrix starters exist with the curated 5-instance library', () => {
    const matrixSlugs = [
      'transitionCount-fix',
      'transitionCount-visit',
      'transitionProbability-fix',
      'transitionDwellMean-fix',
      'transitionDwellMean-visit',
    ]
    const library = createDefaultMetricInstances()
    const byId = new Map(library.map(i => [i.id, i]))
    for (const slug of matrixSlugs) {
      expect(byId.get(slug), slug).toBeDefined()
    }
  })
})

describe('version-independent: groupAggregation → reduction rename', () => {
  const buildWithAgg = (groupAggregation: string): Record<string, unknown> => ({
    version: 5,
    data: {
      metricInstances: [
        {
          id: 'x',
          baseId: 'absoluteTime',
          params: {},
          label: 'X',
          projection: { kind: 'identity-aoi-vector' },
          groupAggregation,
        },
      ],
    },
    gridItems: [],
    fileMetadata: null,
  })

  it('carries a sound legacy value across and drops the old key', () => {
    const inst = runMigrations(buildWithAgg('sum')).data.metricInstances[0]
    expect(inst.reduction).toBe('sum')
    expect('groupAggregation' in inst).toBe(false)
  })

  it('drops an unsound legacy value (median / proportion) so it rides the default', () => {
    for (const legacy of ['median', 'proportion']) {
      const inst = runMigrations(buildWithAgg(legacy)).data.metricInstances[0]
      expect(inst.reduction, legacy).toBeUndefined()
      expect('groupAggregation' in inst, legacy).toBe(false)
    }
  })
})

describe('version-independent: unnamed aggregate-aoi extremes are pruned', () => {
  const buildWithInstances = (instances: unknown[]): Record<string, unknown> => ({
    version: 5,
    data: { metricInstances: instances },
    gridItems: [],
    fileMetadata: null,
  })
  const inst = (id: string, baseId: string, projection: unknown) => ({
    id, baseId, params: {}, label: id, projection,
  })

  it('prunes an aggregate-aoi instance whose metric no longer names the extreme', () => {
    // 1.9.x offered max/min on every aoi-vector metric; fixationDuration now
    // deliberately names none (its Summary `statistic` would double-reduce).
    const m = runMigrations(buildWithInstances([
      inst('stranded', 'fixationDuration', { kind: 'aggregate-aoi', reducer: 'max' }),
      inst('kept', 'absoluteTime', { kind: 'aggregate-aoi', reducer: 'max' }),
    ]))
    const ids = (m.data.metricInstances as MetricInstance[]).map(i => i.id)
    expect(ids).not.toContain('stranded')
    expect(ids).toContain('kept')
  })

  it('prunes a WINDOWED aggregate-aoi on an opted-out metric (inner leaf checked)', () => {
    const m = runMigrations(buildWithInstances([
      inst('stranded-w', 'visitDuration', {
        kind: 'windowed',
        window: { windowSize: 1000, stepSize: 1000 },
        inner: { kind: 'aggregate-aoi', reducer: 'min' },
      }),
    ]))
    expect((m.data.metricInstances as MetricInstance[]).length).toBe(0)
  })

  it('leaves unknown recipes untouched (this registry is not their arbiter)', () => {
    const m = runMigrations(buildWithInstances([
      inst('foreign', 'someFutureMetric', { kind: 'aggregate-aoi', reducer: 'max' }),
    ]))
    expect((m.data.metricInstances as MetricInstance[]).map(i => i.id)).toContain('foreign')
  })

  it('leaves non-aggregate projections and named extremes alone', () => {
    const m = runMigrations(buildWithInstances([
      inst('vec', 'fixationDuration', { kind: 'identity-aoi-vector' }),
      inst('ttf-min', 'timeToFirstFixation', { kind: 'aggregate-aoi', reducer: 'min' }),
    ]))
    expect((m.data.metricInstances as MetricInstance[]).map(i => i.id)).toEqual(['vec', 'ttf-min'])
  })
})

describe('resolveInstance — direct lookup, no fallback', () => {
  const library: MetricInstance[] = [
    { id: 'transitionCount-fix',   baseId: 'transitionCount', params: { mode: 'fixation' }, label: 'TC fix',   projection: { kind: 'identity-aoi-pair-matrix' } },
    { id: 'transitionCount-visit', baseId: 'transitionCount', params: { mode: 'visit' },    label: 'TC visit', projection: { kind: 'identity-aoi-pair-matrix' } },
    { id: 'custom-uuid-1234',      baseId: 'transitionCount', params: { mode: 'fixation' }, label: 'Custom',   projection: { kind: 'identity-aoi-pair-matrix' } },
  ]

  it('returns the direct instance when its id exists', () => {
    expect(resolveInstance(library, 'custom-uuid-1234')?.id).toBe('custom-uuid-1234')
  })

  it('returns undefined when id is missing', () => {
    expect(resolveInstance(library, 'nonexistent')).toBeUndefined()
  })

  it('returns undefined when id is null', () => {
    expect(resolveInstance(library, null)).toBeUndefined()
  })
})

describe('version-independent: statistic param → summary leaf', () => {
  const build = (
    baseId: string,
    projection: unknown,
    params: Record<string, unknown> = { statistic: 'median' },
  ): Record<string, unknown> => ({
    version: 5,
    data: {
      metricInstances: [{ id: 'x', baseId, params, label: 'X', projection }],
    },
    gridItems: [],
    fileMetadata: null,
  })
  const migrated = (...args: Parameters<typeof build>) =>
    runMigrations(build(...args)).data.metricInstances[0]

  it('moves the param onto a pick-aoi leaf', () => {
    const inst = migrated('fixationDuration', {
      kind: 'pick-aoi',
      aoiRef: { by: 'name', name: 'Logo' },
    })
    expect(inst.projection.statistic).toBe('median')
    expect('statistic' in inst.params).toBe(false)
  })

  it('moves it onto a pick-any-fixation leaf, and through a windowed wrapper', () => {
    const inst = migrated('visitDuration', {
      kind: 'windowed',
      window: { windowSize: 1000, stepSize: 100 },
      inner: { kind: 'pick-any-fixation' },
    }, { statistic: 'max' })
    expect(inst.projection.inner.statistic).toBe('max')
    expect(inst.projection.window).toEqual({ windowSize: 1000, stepSize: 100 })
    expect('statistic' in inst.params).toBe(false)
  })

  it('consumes the param on an IDENTITY leaf, which has nowhere to carry it', () => {
    // The accepted cost of the move: a vector is the unmarked per-slot mean.
    // The param is still dropped — left behind it would key the raw cache
    // while `finalize` read the projection.
    const inst = migrated('fixationDuration', { kind: 'identity-aoi-vector' })
    expect('statistic' in inst.params).toBe(false)
    expect(inst.projection).toEqual({ kind: 'identity-aoi-vector' })
  })

  it('never overwrites a statistic the leaf already states', () => {
    const inst = migrated('fixationDuration', {
      kind: 'pick-aoi',
      aoiRef: { by: 'name', name: 'Logo' },
      statistic: 'min',
    })
    expect(inst.projection.statistic).toBe('min')
    expect('statistic' in inst.params).toBe(false)
  })

  it('leaves an unknown recipe untouched — this build is not the arbiter of theirs', () => {
    const inst = migrated('someFutureMetric', { kind: 'identity-scalar' })
    expect(inst.params.statistic).toBe('median')
  })

  it('is idempotent and leaves statistic-free instances untouched', () => {
    const once = build('fixationDuration', { kind: 'pick-aoi', aoiRef: { by: 'name', name: 'Logo' } })
    const first = runMigrations(once).data.metricInstances[0]
    const second = runMigrations({
      version: 5,
      data: { metricInstances: [first] },
      gridItems: [],
      fileMetadata: null,
    }).data.metricInstances[0]
    expect(second).toEqual(first)
    const plain = migrated('fixationCount', { kind: 'identity-aoi-vector' }, {})
    expect(plain.params).toEqual({})
  })
})
