import { describe, it, expect } from 'vitest'
import { DataEngine } from '../src/lib/data/engine/dataEngine.svelte'
import { jsonSegmentsToBinary } from '../src/lib/data/binary'
import {
  generateMetricExport,
  deduplicateMetricLabels,
  METRIC_EXPORT_CONTRACT_LONG,
  METRIC_EXPORT_CONTRACT_WIDE,
} from '../src/lib/data/export/mappers/metrics'
import { instanceMatchesContract, type MetricInstance } from '../src/lib/metrics'
import type { DataType } from '../src/lib/data/types'

function createTestData(): DataType {
  return {
    isOrdinalOnly: false,
    capabilities: { segmented: true, spatial: false, event: false },
    stimuli: {
      data: [
        ['S1', 'StimulusOne'],
        ['S2', 'StimulusTwo'],
      ],
      orderVector: [0, 1],
    },
    participants: {
      data: [
        ['P1', 'ParticipantOne'],
        ['P2', 'ParticipantTwo'],
      ],
      orderVector: [0, 1],
    },
    participantsSelections: [
      {
        id: 1,
        name: 'Group 1',
        participantsIds: [0, 1],
      },
    ],
    metricInstances: [
      {
        id: 'absoluteTime-inst',
        baseId: 'absoluteTime',
        params: {},
        label: 'Absolute Dwell Time',
        projection: { kind: 'identity-aoi-vector' as const },
      },
      {
        id: 'timeToFirstFixation-inst',
        baseId: 'timeToFirstFixation',
        params: {},
        label: 'Time To First Fixation',
        projection: { kind: 'identity-aoi-vector' as const },
      },
      {
        id: 'absoluteTime-windowed-inst',
        baseId: 'absoluteTime',
        params: {},
        label: 'Time on AOI Windowed',
        projection: {
          kind: 'windowed' as const,
          window: { windowSize: 1000, stepSize: 1000 },
          inner: { kind: 'identity-aoi-vector' as const },
        },
      },
      {
        id: 'participantPairSimilarity-inst',
        baseId: 'scanpathLevenshteinSimilarity',
        params: { collapsed: false },
        label: 'Levenshtein similarity',
        projection: { kind: 'identity-participant-pair-matrix' as const },
      },
    ],
    categories: { data: [['Fixation', 'Fixation', '#000000']], orderVector: [0] },
    noAoiTreatment: { displayedName: 'No AOI', color: '#cbd5e1' },
    aois: {
      data: [
        // S1 AOIs: index 0 dummy, index 1 Nav, index 2 CTA
        [
          ['dummy', 'dummy', 'gray'],
          ['Nav', 'Nav', 'red'],
          ['CTA', 'CTA', 'blue'],
        ],
        // S2 AOIs: index 0 dummy, index 1 Logo
        [
          ['dummy', 'dummy', 'gray'],
          ['Logo', 'Logo', 'green'],
        ],
      ],
      orderVector: [
        [1, 2],
        [1],
      ],
    },
    // We construct binary segment buffer:
    // segments: [startTime, endTime, categoryId, ...aoiIds]
    segments: jsonSegmentsToBinary([
      // Stimulus S1 (index 0)
      [
        // Participant P1 (index 0)
        [
          [0, 1000, 0, 1], // Nav
          [1000, 2000, 0, 2], // CTA
        ],
        // Participant P2 (index 1)
        [
          [0, 500, 0, 1], // Nav
          [500, 1500, 0], // Outside (no AOI)
        ],
      ],
      // Stimulus S2 (index 1)
      [
        // Participant P1 (index 0)
        [
          [0, 1000, 0, 1], // Logo
        ],
        // Participant P2 (index 1)
        [
          [0, 1500, 0, 1], // Logo
        ],
      ],
    ]),
    eventData: {
      data: [[]],
      orderVector: [[]],
      events: [],
    },
  }
}

describe('Metric Data Export Mapping', () => {
  it('verifies export contract matching rules', () => {
    const engine = new DataEngine()
    engine.loadDataset(createTestData())

    const plain = engine.metadata!.metricInstances.find(i => i.id === 'absoluteTime-inst')!
    const windowed = engine.metadata!.metricInstances.find(i => i.id === 'absoluteTime-windowed-inst')!
    const relational = engine.metadata!.metricInstances.find(i => i.id === 'participantPairSimilarity-inst')!

    // Long contract allows all shapes and windowed
    expect(instanceMatchesContract(plain, METRIC_EXPORT_CONTRACT_LONG)).toBe(true)
    expect(instanceMatchesContract(windowed, METRIC_EXPORT_CONTRACT_LONG)).toBe(true)
    expect(instanceMatchesContract(relational, METRIC_EXPORT_CONTRACT_LONG)).toBe(true)

    // Wide contract forbids windowed; relational exports as the matrix grid
    expect(instanceMatchesContract(plain, METRIC_EXPORT_CONTRACT_WIDE)).toBe(true)
    expect(instanceMatchesContract(windowed, METRIC_EXPORT_CONTRACT_WIDE)).toBe(false)
    expect(instanceMatchesContract(relational, METRIC_EXPORT_CONTRACT_WIDE)).toBe(true)
  })

  it('exports long format with plain instances, omitting window/relational headers', async () => {
    const engine = new DataEngine()
    engine.loadDataset(createTestData())

    const res = await generateMetricExport(engine, {
      fileName: 'test-export',
      participantIds: [0, 1],
      stimulusIds: [0], // S1 only
      metricInstanceIds: ['absoluteTime-inst'],
      format: 'long',
      includeCodebook: false,
    })

    const lines = res.dataContent.split('\n')
    const header = lines[0]
    expect(header).toBe('Participant_ID,Participant,Stimulus,AOI,Metric,Unit,Value')

    expect(lines).toContain('0,ParticipantOne,StimulusOne,Nav,Absolute Dwell Time,ms,1000')
    expect(lines).toContain('0,ParticipantOne,StimulusOne,CTA,Absolute Dwell Time,ms,1000')
    expect(lines).toContain('0,ParticipantOne,StimulusOne,No_AOI,Absolute Dwell Time,ms,0')
    expect(lines).toContain('0,ParticipantOne,StimulusOne,Any_Fixation,Absolute Dwell Time,ms,2000')

    expect(lines).toContain('1,ParticipantTwo,StimulusOne,Nav,Absolute Dwell Time,ms,500')
    expect(lines).toContain('1,ParticipantTwo,StimulusOne,CTA,Absolute Dwell Time,ms,0')
  })

  it('exports long format with windowed instances, adding Window_Start and Window_End columns', async () => {
    const engine = new DataEngine()
    engine.loadDataset(createTestData())

    const res = await generateMetricExport(engine, {
      fileName: 'test-export',
      participantIds: [0, 1],
      stimulusIds: [0],
      metricInstanceIds: ['absoluteTime-windowed-inst'],
      format: 'long',
      includeCodebook: false,
    })

    const lines = res.dataContent.split('\n')
    const header = lines[0]
    expect(header).toBe('Participant_ID,Participant,Stimulus,Window_Start,Window_End,AOI,Metric,Unit,Value')

    expect(lines).toContain('0,ParticipantOne,StimulusOne,0,1000,Nav,Time on AOI Windowed,ms,1000')
    expect(lines).toContain('0,ParticipantOne,StimulusOne,1000,2000,CTA,Time on AOI Windowed,ms,1000')
  })

  it('exports long format with relational instance, adding Participant_B column', async () => {
    const engine = new DataEngine()
    engine.loadDataset(createTestData())

    const res = await generateMetricExport(engine, {
      fileName: 'test-export',
      participantIds: [0, 1],
      stimulusIds: [0],
      metricInstanceIds: ['participantPairSimilarity-inst'],
      format: 'long',
      includeCodebook: false,
    })

    const lines = res.dataContent.split('\n')
    const header = lines[0]
    expect(header).toBe('Participant_ID,Participant,Stimulus,Participant_B,Metric,Unit,Value')

    // P1 vs P2 exactly once (i < j)
    expect(lines.find(l => l.startsWith('0,ParticipantOne,StimulusOne,ParticipantTwo'))).toBeDefined()
  })

  it('exports wide format with case-per-row, sanitizing and de-duplicating column names', async () => {
    const engine = new DataEngine()
    engine.loadDataset(createTestData())

    const res = await generateMetricExport(engine, {
      fileName: 'test-export',
      participantIds: [0, 1],
      stimulusIds: [0, 1], // Both S1 and S2
      metricInstanceIds: ['absoluteTime-inst'],
      format: 'wide',
      includeCodebook: false,
    })

    const lines = res.dataContent.split('\n')
    const header = lines[0].split(',')

    expect(header.slice(0, 3)).toEqual(['Participant_ID', 'Participant', 'Stimulus'])

    expect(header).toContain('Absolute_Dwell_Time_Nav')
    expect(header).toContain('Absolute_Dwell_Time_CTA')
    expect(header).toContain('Absolute_Dwell_Time_Logo')
    expect(header).toContain('Absolute_Dwell_Time_No_AOI')
    expect(header).toContain('Absolute_Dwell_Time_Any_Fixation')

    const p1s1Row = lines.find(l => l.includes('0,ParticipantOne,StimulusOne'))!
    const p1s1Fields = p1s1Row.split(',')
    const navIdx = header.indexOf('Absolute_Dwell_Time_Nav')
    const ctaIdx = header.indexOf('Absolute_Dwell_Time_CTA')
    const logoIdx = header.indexOf('Absolute_Dwell_Time_Logo')
    const noAoiIdx = header.indexOf('Absolute_Dwell_Time_No_AOI')
    const anyFixIdx = header.indexOf('Absolute_Dwell_Time_Any_Fixation')

    expect(p1s1Fields[navIdx]).toBe('1000')
    expect(p1s1Fields[ctaIdx]).toBe('1000')
    expect(p1s1Fields[logoIdx]).toBe('')
    expect(p1s1Fields[noAoiIdx]).toBe('0')
    expect(p1s1Fields[anyFixIdx]).toBe('2000')
  })

  it('verifies never-fixated AOIs in TTFF export as empty cells (never -1)', async () => {
    const engine = new DataEngine()
    engine.loadDataset(createTestData())

    const res = await generateMetricExport(engine, {
      fileName: 'test-export',
      participantIds: [0, 1],
      stimulusIds: [0],
      metricInstanceIds: ['timeToFirstFixation-inst'],
      format: 'long',
      includeCodebook: false,
    })

    const lines = res.dataContent.split('\n')
    expect(lines).toContain('1,ParticipantTwo,StimulusOne,CTA,Time To First Fixation,ms,')
    expect(lines).not.toContain('1,ParticipantTwo,StimulusOne,CTA,Time To First Fixation,ms,-1')
  })

  it('generates a descriptive sidecar codebook CSV', async () => {
    const engine = new DataEngine()
    engine.loadDataset(createTestData())

    const res = await generateMetricExport(engine, {
      fileName: 'test-export',
      participantIds: [0, 1],
      stimulusIds: [0, 1],
      metricInstanceIds: ['absoluteTime-inst', 'absoluteTime-windowed-inst'],
      format: 'long',
      includeCodebook: true,
    })

    expect(res.codebookContent).not.toBeNull()
    const cbLines = res.codebookContent!.split('\n')
    const cbHeader = cbLines[0]
    expect(cbHeader).toBe(
      'Metric,Base_Metric,Base_Id,Unit,Measurement_Class,Parameters,Projection,Window,Output_Shape,Time_Range,Participants,Stimuli,AOI_Missing'
    )

    expect(cbLines).toContain(
      'Absolute Dwell Time,Absolute dwell time,absoluteTime,ms,extensive,,,,aoi-vector,full,"ParticipantOne, ParticipantTwo","StimulusOne, StimulusTwo",false'
    )
  })

  it('verifies CSV escaping and options like delimiter/decimal comma', async () => {
    const engine = new DataEngine()
    engine.loadDataset(createTestData())

    const res = await generateMetricExport(engine, {
      fileName: 'test-export',
      participantIds: [0, 1],
      stimulusIds: [0],
      metricInstanceIds: ['absoluteTime-inst'],
      format: 'long',
      csvOptions: {
        delimiter: ';',
        decimalSeparator: ',',
      },
      includeCodebook: false,
    })

    const lines = res.dataContent.split('\n')
    expect(lines[0]).toBe('Participant_ID;Participant;Stimulus;AOI;Metric;Unit;Value')
    expect(lines).toContain('0;ParticipantOne;StimulusOne;Nav;Absolute Dwell Time;ms;1000')
  })

  it('clamps windowed timelines to each participant own recording end (ragged, no fabricated rows)', async () => {
    const engine = new DataEngine()
    engine.loadDataset(createTestData())

    const res = await generateMetricExport(engine, {
      fileName: 'test-export',
      participantIds: [0, 1],
      stimulusIds: [0],
      metricInstanceIds: ['absoluteTime-windowed-inst'],
      format: 'long',
      includeCodebook: false,
    })

    const lines = res.dataContent.split('\n')
    // P1 recorded to 2000 ms → windows [0,1000) and [1000,2000)
    expect(lines.some(l => l.startsWith('0,ParticipantOne,StimulusOne,1000,2000'))).toBe(true)
    // P2 recorded to 1500 ms → only [0,1000) fits; the second window must NOT
    // be fabricated from the stimulus-global end time
    expect(lines.some(l => l.startsWith('1,ParticipantTwo,StimulusOne,0,1000'))).toBe(true)
    expect(lines.some(l => l.startsWith('1,ParticipantTwo,StimulusOne,1000,'))).toBe(false)
  })

  it('rejects contract-incompatible instances at the mapper, not only in the modal UI', async () => {
    const engine = new DataEngine()
    engine.loadDataset(createTestData())

    const base = {
      fileName: 'test-export',
      participantIds: [0, 1],
      stimulusIds: [0],
      format: 'wide' as const,
      includeCodebook: false,
    }
    await expect(
      generateMetricExport(engine, { ...base, metricInstanceIds: ['absoluteTime-windowed-inst'] })
    ).rejects.toThrow(/Not exportable in wide format: Time on AOI Windowed/)
  })

  it('exports a relational metric in wide format as the full matrix grid', async () => {
    const engine = new DataEngine()
    engine.loadDataset(createTestData())

    const res = await generateMetricExport(engine, {
      fileName: 'test-export',
      participantIds: [0, 1],
      stimulusIds: [0],
      metricInstanceIds: ['participantPairSimilarity-inst'],
      format: 'wide',
      includeCodebook: false,
    })

    const lines = res.dataContent.split('\n')
    const header = lines[0].split(',')
    expect(new Set(header).size).toBe(header.length)

    const colP1 = header.indexOf('Levenshtein_similarity_ParticipantOne')
    const colP2 = header.indexOf('Levenshtein_similarity_ParticipantTwo')
    expect(colP1).toBeGreaterThan(-1)
    expect(colP2).toBeGreaterThan(-1)

    const rowP1 = lines.find(l => l.startsWith('0,ParticipantOne,StimulusOne'))!.split(',')
    const rowP2 = lines.find(l => l.startsWith('1,ParticipantTwo,StimulusOne'))!.split(',')

    // The off-diagonal cells carry the pair value symmetrically; emitted
    // verbatim from the group result (diagonal included).
    expect(rowP1[colP2]).not.toBe('')
    expect(rowP1[colP2]).toBe(rowP2[colP1])
  })

  it('exports exactly the selected participants, in both formats', async () => {
    const engine = new DataEngine()
    engine.loadDataset(createTestData())

    const long = await generateMetricExport(engine, {
      fileName: 'test-export',
      participantIds: [1],
      stimulusIds: [0],
      metricInstanceIds: ['absoluteTime-inst'],
      format: 'long',
      includeCodebook: false,
    })
    const longLines = long.dataContent.split('\n')
    expect(longLines.some(l => l.startsWith('1,ParticipantTwo,'))).toBe(true)
    expect(longLines.some(l => l.startsWith('0,ParticipantOne,'))).toBe(false)

    const wide = await generateMetricExport(engine, {
      fileName: 'test-export',
      participantIds: [1],
      stimulusIds: [0],
      metricInstanceIds: ['participantPairSimilarity-inst'],
      format: 'wide',
      includeCodebook: false,
    })
    const wideHeader = wide.dataContent.split('\n')[0].split(',')
    // Relational columns cover only the selected participants
    expect(wideHeader).toContain('Levenshtein_similarity_ParticipantTwo')
    expect(wideHeader).not.toContain('Levenshtein_similarity_ParticipantOne')
  })

  it('rejects a non-finite or inverted time range', async () => {
    const engine = new DataEngine()
    engine.loadDataset(createTestData())

    const base = {
      fileName: 'test-export',
      participantIds: [0, 1],
      stimulusIds: [0],
      metricInstanceIds: ['absoluteTime-inst'],
      format: 'long' as const,
      includeCodebook: false,
    }
    await expect(
      generateMetricExport(engine, { ...base, timeStart: Number.NaN })
    ).rejects.toThrow(/Time range/)
    await expect(
      generateMetricExport(engine, { ...base, timeStart: -5 })
    ).rejects.toThrow(/Time range/)
    await expect(
      generateMetricExport(engine, { ...base, timeStart: 1000, timeEnd: 500 })
    ).rejects.toThrow(/Time end/)
  })

  it('assigns collision-proof labels even when a base label already carries a suffix', () => {
    const mk = (id: string, label: string) =>
      ({ id, baseId: 'absoluteTime', params: {}, label, projection: { kind: 'identity-aoi-vector' } }) as MetricInstance
    const labels = deduplicateMetricLabels([
      mk('a', 'Dwell'),
      mk('b', 'Dwell'),
      mk('c', 'Dwell (2)'),
    ])
    expect(labels.get('a')).toBe('Dwell')
    expect(labels.get('b')).toBe('Dwell (2)')
    expect(labels.get('c')).toBe('Dwell (2) (2)')
    expect(new Set(labels.values()).size).toBe(3)
  })

  it('keeps a real AOI displayed-named No_AOI distinct from the synthetic column in wide format', async () => {
    const data = createTestData()
    // Rename S1's "Nav" so its displayed name collides with the synthetic slot.
    data.aois.data[0][1] = ['Nav', 'No_AOI', 'red']
    const engine = new DataEngine()
    engine.loadDataset(data)

    const res = await generateMetricExport(engine, {
      fileName: 'test-export',
      participantIds: [0, 1],
      stimulusIds: [0],
      metricInstanceIds: ['absoluteTime-inst'],
      format: 'wide',
      includeCodebook: false,
    })

    const lines = res.dataContent.split('\n')
    const header = lines[0].split(',')
    expect(new Set(header).size).toBe(header.length)

    const realIdx = header.indexOf('Absolute_Dwell_Time_No_AOI')
    const syntheticIdx = header.indexOf('Absolute_Dwell_Time_No_AOI_2')
    expect(realIdx).toBeGreaterThan(-1)
    expect(syntheticIdx).toBeGreaterThan(-1)

    // P1: 1000 ms on the renamed AOI, and no fixation outside any AOI.
    const p1Row = lines.find(l => l.startsWith('0,ParticipantOne,StimulusOne'))!.split(',')
    expect(p1Row[realIdx]).toBe('1000')
    expect(p1Row[syntheticIdx]).toBe('0')
  })
})
