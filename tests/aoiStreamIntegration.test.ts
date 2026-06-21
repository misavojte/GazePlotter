import { describe, it, expect } from 'vitest'
import { createReaderFromJson } from '../src/lib/data/binary/converters'
import { getAoiStreamPlotData } from '../src/lib/plots/aoi-stream/core/transformer'
import { createDefaultMetricInstances } from '../src/lib/metrics/instances'

const WINDOWED_TIME_INSTANCE_ID = 'absoluteTime-aoi-windowed-500'

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

describe('AOI Stream Plot Transformer (Integration)', () => {
  const stimulusId = 0
  const groupId = -1

  it('transforms raw segments into time series binned occupancy', () => {
    const engine = createMockEngine([
      [
        [
          [0, 100, 0, 0], // AOI A
          [100, 300, 0, 1], // AOI B
          [300, 350, 0], // Outside (No AOI)
        ],
      ],
    ])

    const result = getAoiStreamPlotData(
      engine as any,
      {
        stimulusId,
        groupId,
        metricInstanceIds: [WINDOWED_TIME_INSTANCE_ID],
      } as any
    )

    // Outside (No AOI) should be present since hideNoAoi is undefined (defaults to false)
    expect(result.series).toHaveLength(3)
    expect(result.series[0].label).toBe('AOI A')
    expect(result.series[1].label).toBe('AOI B')
    expect(result.series[2].label).toBe('Outside')
  })

  it('exposes the metric native unit so the bin tooltip can show real values (not a fabricated %)', () => {
    const engine = createMockEngine([
      [
        [
          [0, 100, 0, 0],
          [100, 300, 0, 1],
        ],
      ],
    ])

    const result = getAoiStreamPlotData(
      engine as any,
      {
        stimulusId,
        groupId,
        metricInstanceIds: [WINDOWED_TIME_INSTANCE_ID],
      } as any
    )

    // Windowed absolute dwell is in ms; the tooltip shows native values in this
    // unit, matching the axis — never `(value / participants) * 100 + "%"`.
    expect(result.unit).toBe('ms')
    expect(result.yAxisLabel).toContain('ms')
  })

  it('correctly filters out Outside (No AOI) when hideNoAoi is true', () => {
    const engine = createMockEngine([
      [
        [
          [0, 100, 0, 0],
          [100, 300, 0, 1],
          [300, 350, 0],
        ],
      ],
    ])

    const result = getAoiStreamPlotData(
      engine as any,
      {
        stimulusId,
        groupId,
        metricInstanceIds: [WINDOWED_TIME_INSTANCE_ID],
        hideNoAoi: true,
      } as any
    )

    // Only AOI A and AOI B should be in the series list
    expect(result.series).toHaveLength(2)
    expect(result.series[0].label).toBe('AOI A')
    expect(result.series[1].label).toBe('AOI B')
    expect(result.series.find(s => s.label === 'Outside')).toBeUndefined()
  })

  it('excludes Outside (No AOI) from maxValue and maxTotal calculations when hideNoAoi is true', () => {
    const engine = createMockEngine([
      [
        [
          [0, 50, 0, 0], // AOI A (50 ms)
          [50, 100, 0, 1], // AOI B (50 ms)
          [100, 500, 0], // Outside (400 ms)
        ],
      ],
    ])

    const result = getAoiStreamPlotData(
      engine as any,
      {
        stimulusId,
        groupId,
        metricInstanceIds: [WINDOWED_TIME_INSTANCE_ID],
        hideNoAoi: true,
      } as any
    )

    // Check that maximums are calculated using only AOI A and AOI B values (50 ms)
    expect(result.maxValue).toBeLessThanOrEqual(50)
    expect(result.maxTotal).toBeLessThanOrEqual(100) // AOI A + AOI B in the 0-500 ms window
  })
})
