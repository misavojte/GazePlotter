import { describe, it, expect } from 'vitest'
import { createReaderFromJson } from '../src/lib/data/binary/converters'
import { getBarPlotData } from '../src/lib/plots/bar/core/transformer'
import { createDefaultMetricInstances } from '../src/lib/metrics/instances'

const ABSOLUTE_TIME_INSTANCE_ID = 'absoluteTime'

function createMockEngine(segments: number[][][][]) {
  const reader = createReaderFromJson(segments)

  return {
    metadata: {
      isOrdinalOnly: false,
      capabilities: {
        segmented: true,
        spatial: false,
        event: false,
      },
      aois: {
        data: [
          [
            ['AOI A', 'AOI A', 'red'],
            ['AOI B', 'AOI B', 'blue'],
          ],
        ],
        orderVector: [[]],
        hiddenAois: [[]],
      },
      categories: {
        data: [['Fixation', 'Fixation', '#000000']],
        orderVector: [],
      },
      participants: {
        data: [['P101', 'Participant 101']],
        orderVector: [0],
      },
      participantsGroups: [],
      stimuli: {
        data: [['Stimulus 1', 'Stimulus 1']],
        orderVector: [0],
      },
      noAoiTreatment: { displayedName: 'Outside', color: 'gray' },
      metricInstances: createDefaultMetricInstances(),
    },
    getReader: () => reader,
    getAoiMapping: (_stimulusId: number, rawId: number) => rawId,
  }
}

describe('Bar Plot Transformer (Integration)', () => {
  const stimulusId = 0
  const groupId = -1

  it('transforms raw segments into labeled and sorted bar data', () => {
    const engine = createMockEngine([
      [
        [
          [0, 100, 0, 0],
          [100, 300, 0, 1],
          [300, 350, 0],
        ],
      ],
    ])

    const result = getBarPlotData(
      engine as any,
      {
        stimulusId,
        groupId,
        metricInstanceId: ABSOLUTE_TIME_INSTANCE_ID,
        orderBy: 'aoi',
        orderDirection: 'asc',
        scaleRange: [0, 0],
      } as any
    )

    expect(result.data).toHaveLength(3)
    expect(result.data[0].label).toBe('AOI A')
    expect(result.data[0].value).toBe(100)
    expect(result.data[1].label).toBe('AOI B')
    expect(result.data[1].value).toBe(200)
    expect(result.data[2].label).toBe('Outside')
    expect(result.data[2].value).toBe(50)
  })

  it('applies sorting by value descending', () => {
    const engine = createMockEngine([
      [
        [
          [0, 100, 0, 0],
          [100, 300, 0, 1],
        ],
      ],
    ])

    const result = getBarPlotData(
      engine as any,
      {
        stimulusId,
        groupId,
        metricInstanceId: ABSOLUTE_TIME_INSTANCE_ID,
        orderBy: 'value',
        orderDirection: 'desc',
        scaleRange: [0, 0],
      } as any
    )

    expect(result.data[0].label).toBe('AOI B')
    expect(result.data[1].label).toBe('AOI A')
  })

  it('generates a nice timeline based on data max value', () => {
    const engine = createMockEngine([[[[0, 450, 0, 0]]]])

    const result = getBarPlotData(
      engine as any,
      {
        stimulusId,
        groupId,
        metricInstanceId: ABSOLUTE_TIME_INSTANCE_ID,
      } as any
    )

    expect(result.timeline.maxValue).toBeGreaterThanOrEqual(450)
  })

  it('handles custom scale range', () => {
    const engine = createMockEngine([[[[0, 100, 0, 0]]]])

    const result = getBarPlotData(
      engine as any,
      {
        stimulusId,
        groupId,
        metricInstanceId: ABSOLUTE_TIME_INSTANCE_ID,
        scaleRange: [0, 1000],
      } as any
    )

    expect(result.timeline.maxValue).toBe(1000)
  })

  it('handles lack of participants', () => {
    const engine = createMockEngine([[]])
    engine.metadata.participants.data = []
    engine.metadata.participants.orderVector = []

    const result = getBarPlotData(
      engine as any,
      {
        stimulusId,
        groupId: -1,
      } as any
    )

    expect(result.data).toEqual([])
  })

  it('flags noMetric when metricInstanceId references a deleted instance', () => {
    const engine = createMockEngine([
      [
        [
          [0, 100, 0, 0],
          [100, 300, 0, 1],
        ],
      ],
    ])

    const result = getBarPlotData(
      engine as any,
      {
        stimulusId,
        groupId,
        metricInstanceId: 'nonexistent-id', // does not exist in the library
        orderBy: 'aoi',
        orderDirection: 'asc',
        scaleRange: [0, 0],
      } as any
    )

    expect(result.noMetric).toBe(true)
    expect(result.data).toEqual([])
  })
})
