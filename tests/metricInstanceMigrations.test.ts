import { describe, it, expect } from 'vitest'
import { runMigrations } from '../src/lib/data/ingest/workspace/migrations'
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
      participantsGroups: [],
      categories: { data: [], orderVector: [] },
      aois: {
        data: [[]],
        orderVector: [[]],
        hiddenAois: [],
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

    expect(migrated.version).toBe(6)
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
    expect(ed.hiddenChannels).toEqual([[]])
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
    expect(runMigrations(buildTMFile('sum')).version).toBe(6)
  })

  it('drops aggregationMethod from migrated settings', () => {
    const s = runMigrations(buildTMFile('sum')).gridItems[0].settings
    expect(s.aggregationMethod).toBeUndefined()
  })

  it('sum → metricInstanceId = "transitionCount-fix"', () => {
    const s = runMigrations(buildTMFile('sum')).gridItems[0].settings
    expect(s.metricInstanceId).toBe('transitionCount-fix')
  })

  it('probability → metricInstanceId = "transitionProbability-fix"', () => {
    const s = runMigrations(buildTMFile('probability')).gridItems[0].settings
    expect(s.metricInstanceId).toBe('transitionProbability-fix')
  })

  it('dwellTime → metricInstanceId = "transitionDwellMean-fix"', () => {
    const s = runMigrations(buildTMFile('dwellTime')).gridItems[0].settings
    expect(s.metricInstanceId).toBe('transitionDwellMean-fix')
  })

  it('segmentDwellTime → metricInstanceId = "transitionDwellMean-visit"', () => {
    const s = runMigrations(buildTMFile('segmentDwellTime')).gridItems[0].settings
    expect(s.metricInstanceId).toBe('transitionDwellMean-visit')
  })

  it('frequencyRelative → creates custom transitionRelativeFrequency instance (UUID id)', () => {
    const m = runMigrations(buildTMFile('frequencyRelative'))
    const id = m.gridItems[0].settings.metricInstanceId
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
      const id = m.gridItems[0].settings.metricInstanceId
      expect(typeof id).toBe('string')
      const created = (m.data.metricInstances as MetricInstance[]).find(i => i.id === id)
      expect(created).toBeDefined()
      expect(created!.baseId).toBe('transitionProbability')
      expect(created!.params).toEqual({ mode: 'fixation', step })
    }
  })

  it('unknown aggregationMethod falls back to "transitionCount-fix"', () => {
    const s = runMigrations(buildTMFile('notARealMethod')).gridItems[0].settings
    expect(s.metricInstanceId).toBe('transitionCount-fix')
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
    const [id1, id2] = m.gridItems.map((g: any) => g.settings.metricInstanceId)
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
    expect(runMigrations(buildBarFile('absoluteTime')).version).toBe(6)
  })

  it('drops aggregationMethod from migrated settings', () => {
    const m = runMigrations(buildBarFile('absoluteTime'))
    expect(m.gridItems[0].settings.aggregationMethod).toBeUndefined()
  })

  for (const [method, expectedSlug] of Object.entries(expectedSlugFor)) {
    it(`${method} → metricInstanceId = "${expectedSlug}"`, () => {
      const m = runMigrations(buildBarFile(method))
      expect(m.gridItems[0].settings.metricInstanceId).toBe(expectedSlug)
    })
  }

  it('unknown aggregationMethod falls back to "absoluteTime"', () => {
    const m = runMigrations(buildBarFile('notARealMethod'))
    expect(m.gridItems[0].settings.metricInstanceId).toBe('absoluteTime')
  })

  it('missing aggregationMethod falls back to "absoluteTime"', () => {
    const m = runMigrations(buildBarFile(undefined))
    expect(m.gridItems[0].settings.metricInstanceId).toBe('absoluteTime')
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
    expect(scarf.settings.metricInstanceId).toBeUndefined()
    expect(scarf.settings.aggregationMethod).toBeUndefined()
  })
})

describe('V5 → V6 baseId rename migration', () => {
  function buildV5File(metricInstances: MetricInstance[]): Record<string, unknown> {
    return {
      version: 5,
      data: {
        stimuli: { data: [['S1']], orderVector: [0] },
        participants: { data: [['P1']], orderVector: [0] },
        participantsGroups: [],
        categories: { data: [], orderVector: [] },
        aois: { data: [[]], orderVector: [[]], hiddenAois: [], dynamicVisibility: {} },
        eventData: { data: [[]], hiddenChannels: [[]], events: [] },
        capabilities: { segmented: true, spatial: false, event: false },
        noAoiTreatment: { color: '#cbd5e1', displayedName: 'No AOI' },
        isOrdinalOnly: false,
        metricInstances,
      },
      gridItems: [],
      fileMetadata: null,
    }
  }

  it('bumps version to 6', () => {
    const migrated = runMigrations(buildV5File([]))
    expect(migrated.version).toBe(6)
  })

  const renames: Array<[string, string]> = [
    ['averageEntries',           'visitCount'],
    ['avgDwellDuration',         'visitDuration'],
    ['averageFixationCount',     'fixationCount'],
    ['avgFixationDuration',      'fixationDuration'],
    ['avgFirstFixationDuration', 'firstFixationDuration'],
  ]

  for (const [legacy, canonical] of renames) {
    it(`rewrites stored baseId ${legacy} → ${canonical}`, () => {
      const legacyInst: MetricInstance = {
        id: 'custom-uuid',
        baseId: legacy,
        params: {},
        projection: { kind: 'identity-aoi-vector' },
        label: 'legacy',
      }
      const migrated = runMigrations(buildV5File([legacyInst]))
      const result = (migrated.data.metricInstances as MetricInstance[])[0]
      expect(result.baseId).toBe(canonical)
      expect(result.id).toBe('custom-uuid')
    })
  }

  it('leaves unknown baseIds untouched', () => {
    const inst: MetricInstance = {
      id: 'custom-uuid',
      baseId: 'someFutureRecipe',
      params: {},
      projection: { kind: 'identity-aoi-vector' },
      label: 'future',
    }
    const migrated = runMigrations(buildV5File([inst]))
    expect((migrated.data.metricInstances as MetricInstance[])[0].baseId).toBe('someFutureRecipe')
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
