import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { applyAnalysis, exportAnalysis, inspect, metricCatalog } from '$lib/data/analysis'
import { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { exportMetrics } from '$lib/data/export/mappers/metrics'
import { ingest } from '$lib/data/ingest/ingest'
import { generateWorkspaceJson } from '$lib/data/export/mappers/workspace'
import { unfoldMerges } from '$lib/data/merge/applyMerges'
import { mergeParticipants } from '$lib/data/merge/mergeParticipants'
import { makeDataType } from './helpers/dataTypeFixtures'

// The headless core runs in this Node environment, which has no DOM: every
// test here is also proof that the path needs none.
expect(typeof document).toBe('undefined')

const GAZE = `Time,Participant,Stimulus,AOI
0,P1,Map_A,Region_1
1,P1,Map_A,Region_1
2,P1,Map_A,Region_2
3,P1,Map_A,
4,P2,Map_A,Region_1
5,P2,Map_A,Region_1
6,P1,Map_B,Region_1
7,P1,Map_B,Region_2
`
const EVENTS = `stimulus,participant,eventName,start,duration
Map_A,P1,click,1,0
Map_A,P2,click,4.5,0.5
`
const file = (name: string, text: string) => new File([text], name)
const DEMO = resolve(__dirname, '../static/data/demo.json')
const demoFile = async () => new File([await readFile(DEMO)], 'demo.json')

// A merge must be disjoint: P0 records on S0 only, P2 on S1 only.
const segments = [
  [[[0, 100, 0, 0]], [[0, 100, 0, 0]], []],
  [[], [[0, 100, 0, 0]], [[0, 100, 0, 0]]],
]
const named = () =>
  makeDataType(segments, {
    participants: {
      data: [['p01', 'Alice'], ['p02', 'Bob'], ['p03', 'Cara']],
      orderVector: [0, 1, 2],
    },
  })

describe('ingest', () => {
  it('loads a recording with the starter metric library', async () => {
    const { engine, kind, warnings } = await ingest([file('rec.csv', GAZE)])
    expect(kind).toBe('dataset')
    expect(warnings).toEqual([])
    const seen = inspect(engine)
    expect(seen.participants).toEqual(['P1', 'P2'])
    expect(seen.stimuli.map(s => s.name)).toEqual(['Map_A', 'Map_B'])
    expect(seen.stimuli[0].aois).toEqual(['Region_1', 'Region_2'])
    expect(seen.stimuli[1].recorded).toEqual(['P1'])
    expect(seen.metrics.length).toBeGreaterThan(0)
  })

  it('annotates the recording with a CSV event file', async () => {
    const { engine } = await ingest([file('rec.csv', GAZE), file('events.csv', EVENTS)])
    const seen = inspect(engine)
    expect(seen.capabilities.event).toBe(true)
    expect(seen.stimuli[0].events).toEqual(['click'])
  })

  it('folds a saved workspace\'s merges, as the app does', async () => {
    // The file is original-on-disk: pristine rows plus the merge log.
    const merged = mergeParticipants(named(), 0, [2], 1)
    const json = generateWorkspaceJson(unfoldMerges(merged), [], null)
    const { engine, kind } = await ingest([file('study.json', json)])
    expect(kind).toBe('workspace')
    expect(inspect(engine).participants).toEqual(['Alice', 'Bob'])
  })

  it('exports the metrics table the app exports', async () => {
    const { engine } = await ingest([file('rec.csv', GAZE)])
    const seen = inspect(engine)
    const result = await exportMetrics(engine, {
      fileName: 'm',
      participantIds: [0, 1],
      stimulusIds: [0, 1],
      metricInstanceIds: seen.metrics.filter(m => m.shape === 'aoi-vector').map(m => m.id).slice(0, 1),
      format: 'long',
    })
    expect(result.rows).toBeGreaterThan(0)
    expect(result.dataContent.split('\n')[0]).toContain('Participant_ID')
  })

  it('lists the metric library', () => {
    expect(metricCatalog().map(m => m.id)).toContain('absoluteTime')
  })
})

describe('analysis', () => {
  it('round-trips renames, merges, and selections by displayed name', () => {
    let source = named()
    source.aois.data[0] = [['A', 'Face', '#ff0000']]
    source = mergeParticipants(source, 0, [2], 1)
    source.participantsSelections = [{ id: 7, name: 'Pair', participantsIds: [0, 1] }]
    source.stimuliSelections = [{ id: 3, name: 'First', memberIds: [0] }]

    const analysis = exportAnalysis(source)
    expect(analysis.renames.participants).toEqual([
      { from: 'p01', to: 'Alice' },
      { from: 'p02', to: 'Bob' },
      { from: 'p03', to: 'Cara' },
    ])
    expect(analysis.renames.aois).toEqual({ S0: [{ from: 'A', to: 'Face' }] })
    expect(analysis.merges).toEqual([{ axis: 'participant', into: 'Alice', members: ['Cara'] }])
    expect(analysis.selections.participants).toEqual([{ name: 'Pair', members: ['Alice', 'Bob'] }])

    const fresh = makeDataType(segments, {
      participants: { data: [['p01'], ['p02'], ['p03']], orderVector: [0, 1, 2] },
    })
    const { data, unmatched } = applyAnalysis(fresh, analysis)
    expect(unmatched).toEqual([])
    expect(exportAnalysis(data)).toEqual(analysis)
    expect(data.participants.orderVector).toEqual([0, 1])
    const engine = new DataEngine()
    engine.loadDataset(data)
    expect(inspect(engine).participants).toEqual(['Alice', 'Bob'])
  })

  it('replays the shipped demo workspace onto itself without a miss', async () => {
    // The demo stores empty order vectors, which the engine reads as identity.
    const { engine } = await ingest([await demoFile()])
    const data = engine.toDataType()!
    const analysis = exportAnalysis(data)
    expect(analysis.selections.categories).toEqual([{ name: 'Just fixations', members: ['Fixation'] }])
    const applied = applyAnalysis(data, analysis)
    expect(applied.unmatched).toEqual([])
    const again = exportAnalysis(applied.data)
    expect({ ...again, metrics: again.metrics.map(m => m.id) }).toEqual({
      ...analysis,
      metrics: analysis.metrics.map(m => m.id),
    })
  })

  it('reports every name it cannot find, and guesses none', () => {
    const analysis = exportAnalysis(named())
    analysis.renames.participants.push({ from: 'p09', to: 'Zed' })
    analysis.merges.push({ axis: 'participant', into: 'Alice', members: ['Nobody'] })
    analysis.selections.stimuli.push({ name: 'Odd', members: ['S9'] })
    analysis.metrics.push({ ...analysis.metrics[0], id: 'x', baseId: 'noSuchMetric' })
    const { data, unmatched } = applyAnalysis(named(), analysis)
    expect(unmatched).toEqual([
      'participant: p09',
      'merge member participant: Nobody',
      'metric: noSuchMetric',
      'stimuli selection Odd: S9',
    ])
    expect(data.participants.orderVector).toEqual([0, 1, 2])
    expect(data.stimuliSelections).toEqual([{ id: 1, name: 'Odd', memberIds: [] }])
    expect(data.metricInstances.map(m => m.id)).not.toContain('x')
  })

  it('refuses a merge whose members overlap, naming them', () => {
    const analysis = exportAnalysis(named())
    analysis.merges.push({ axis: 'participant', into: 'Alice', members: ['Bob'] })
    expect(() => applyAnalysis(named(), analysis)).toThrow(/Merge of Bob into Alice refused/)
  })
})

