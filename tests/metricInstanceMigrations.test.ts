import { describe, it, expect } from 'vitest'
import { runMigrations } from '../src/lib/data/ingest/workspace/migrations'
import { createSystemMetricInstances } from '../src/lib/plots/metrics/instances'

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

describe('V5 → V6 metric-instance migration', () => {
  it('seeds metricInstances on metadata when missing', () => {
    const file = buildV5File({ enabledMetrics: [] })
    const migrated = runMigrations(file)

    expect(migrated.version).toBe(6)
    const seeded = migrated.data.metricInstances
    expect(Array.isArray(seeded)).toBe(true)
    expect(seeded.length).toBe(createSystemMetricInstances().length)
    expect(seeded.every((i: any) => i.system === true)).toBe(true)
  })

  it('preserves an existing metricInstances array (idempotent)', () => {
    const file = buildV5File({ enabledMetrics: [] })
    ;(file.data as any).metricInstances = [
      { id: 1, baseId: 'absoluteTime', params: {}, label: 'Renamed', system: true },
    ]

    const migrated = runMigrations(file)

    expect(migrated.data.metricInstances).toEqual([
      { id: 1, baseId: 'absoluteTime', params: {}, label: 'Renamed', system: true },
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

    // 'fixationCount' is not a valid legacy id; only the real ones map.
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

  it('leaves non-metricCorrelation grid items untouched', () => {
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
    expect(bar.settings.aggregationMethod).toBe('absoluteTime')
    expect(bar.settings.enabledMetricIds).toBeUndefined()
  })
})
