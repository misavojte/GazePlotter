import { describe, it, expect } from 'vitest'
import { createReaderFromJson } from '../src/lib/data/binary/converters'
import { getTransitionMatrixData } from '../src/lib/plots/transition-matrix/core/transformer'
import { createDefaultMetricInstances } from '../src/lib/metrics/instances'

const TRANSITION_COUNT_INSTANCE_ID = 'transitionCount-fix'

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

describe('Transition Matrix Plot Transformer (Integration)', () => {
  const stimulusId = 0
  const groupId = -1

  it('transforms raw segments into a transition matrix with Outside', () => {
    const engine = createMockEngine([
      [
        [
          [0, 100, 0, 0], // AOI A (0)
          [100, 200, 0, 1], // AOI B (1)
          [200, 300, 0], // Outside (2)
        ],
      ],
    ])

    const result = getTransitionMatrixData(
      engine as any,
      stimulusId,
      groupId,
      TRANSITION_COUNT_INSTANCE_ID
    )

    // Outside (No AOI) should be present (default: size 3x3)
    expect(result.aoiLabels).toHaveLength(3)
    expect(result.aoiLabels[0]).toBe('AOI A')
    expect(result.aoiLabels[1]).toBe('AOI B')
    expect(result.aoiLabels[2]).toBe('Outside')

    // matrix length should be 3 * 3 = 9
    expect(result.matrix).toHaveLength(9)
  })

  it('correctly filters out Outside (No AOI) when hideNoAoi is true', () => {
    const engine = createMockEngine([
      [
        [
          [0, 100, 0, 0], // AOI A (0)
          [100, 200, 0, 1], // AOI B (1)
          [200, 300, 0], // Outside (2)
        ],
      ],
    ])

    const result = getTransitionMatrixData(
      engine as any,
      stimulusId,
      groupId,
      TRANSITION_COUNT_INSTANCE_ID,
      0,
      0,
      true // hideNoAoi = true
    )

    // Only AOI A and AOI B should be in the labels list (size 2x2)
    expect(result.aoiLabels).toHaveLength(2)
    expect(result.aoiLabels[0]).toBe('AOI A')
    expect(result.aoiLabels[1]).toBe('AOI B')
    expect(result.aoiLabels).not.toContain('Outside')

    // matrix length should be 2 * 2 = 4
    expect(result.matrix).toHaveLength(4)
  })
})
