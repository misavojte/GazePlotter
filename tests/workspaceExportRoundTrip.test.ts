import { describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION, type DataType } from '../src/lib/data/types'
import { jsonSegmentsToBinary } from '../src/lib/data/binary'
import { createDefaultMetricInstances } from '../src/lib/metrics/instances'
import { generateWorkspaceJson } from '../src/lib/data/export/mappers/workspace'
import { runMigrations } from '../src/lib/data/ingest/workspace/migrations'

// Regression guard for the schema-version mislabel: the workspace export used
// to stamp a hardcoded version that lagged the data it wrote, so re-imports
// only survived because a now-removed migration step happened to be idempotent.
// The export now sources `CURRENT_SCHEMA_VERSION` — the same constant the
// migration ceiling produces — so the stamp always matches the live shape and
// re-importing triggers no migration at all.

function createData(): DataType {
  return {
    isOrdinalOnly: false,
    capabilities: { segmented: true, spatial: false, event: false },
    stimuli: { data: [['Stimulus A', 'Stimulus A']], orderVector: [0] },
    participants: { data: [['Participant A', 'Participant A']], orderVector: [0] },
    participantsGroups: [],
    metricInstances: createDefaultMetricInstances(),
    categories: { data: [['Fixation', 'Fixation', '#000000']], orderVector: [0] },
    noAoiTreatment: { displayedName: 'No AOI', color: '#cbd5e1' },
    aois: {
      data: [[['AOI 1', 'AOI 1', '#ff0000']]],
      orderVector: [[0]],
      hiddenAois: [[]],
    },
    segments: jsonSegmentsToBinary([[[[0, 100, 0, 0]]]]),
    eventData: { data: [[]], orderVector: [], hiddenChannels: [], events: [[]] },
  }
}

// Live-shape grid items: already on `metricInstanceIds` and with `hideNoAoi`
// set, so the version-independent normalization passes are no-ops too.
const gridItems = [
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
      metricInstanceIds: ['absoluteTime'],
      hideNoAoi: false,
    },
  },
  {
    id: 'stream-1',
    type: 'aoiStreamPlot',
    x: 0,
    y: 8,
    w: 12,
    h: 10,
    settings: {
      stimulusId: 0,
      groupId: -1,
      metricInstanceIds: ['absoluteTime-aoi-windowed-500'],
      hideNoAoi: false,
    },
  },
]

describe('workspace export round-trip: version stamp matches current schema', () => {
  it('stamps the export with CURRENT_SCHEMA_VERSION', () => {
    const parsed = JSON.parse(generateWorkspaceJson(createData(), gridItems, null))
    expect(parsed.version).toBe(CURRENT_SCHEMA_VERSION)
  })

  it('re-importing the export runs no schema migration and preserves settings', () => {
    const parsed = JSON.parse(generateWorkspaceJson(createData(), gridItems, null))
    const migrated = runMigrations(parsed)

    // Version is unchanged — the stamp already matches the data, so no
    // version-gated block fires.
    expect(migrated.version).toBe(CURRENT_SCHEMA_VERSION)

    // Metric references survive untouched (not "rescued" by a translation pass).
    const bar = migrated.gridItems!.find((g: any) => g.type === 'barPlot') as any
    const stream = migrated.gridItems!.find(
      (g: any) => g.type === 'aoiStreamPlot'
    ) as any
    expect(bar.settings.metricInstanceIds).toEqual(['absoluteTime'])
    expect(stream.settings.metricInstanceIds).toEqual(['absoluteTime-aoi-windowed-500'])
  })

  it('is stable across a second migration pass (idempotent re-import)', () => {
    const parsed = JSON.parse(generateWorkspaceJson(createData(), gridItems, null))
    const once = runMigrations(parsed)
    const twice = runMigrations(JSON.parse(JSON.stringify(once)))
    expect(twice.version).toBe(CURRENT_SCHEMA_VERSION)
    expect(twice.gridItems).toEqual(once.gridItems)
  })
})
