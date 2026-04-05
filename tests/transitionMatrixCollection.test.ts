import { describe, it, expect } from 'vitest'
import { createReaderFromJson } from '../src/lib/data/binary/converters'
import { collectTransitionMetrics } from '../src/lib/plots/transition-matrix/core/collector'

function createMockEngine(segments: number[][][][]) {
  const reader = createReaderFromJson(segments)

  return {
    metadata: {
      isOrdinalOnly: false,
      aois: {
        data: [[], [
          ['AOI 1', 'AOI 1', 'red'],
          ['AOI 2', 'AOI 2', 'blue'],
        ]],
        orderVector: [[], [1, 2]],
        hiddenAois: [[], []],
      },
      categories: {
        data: [['Fixation', 'Fixation', '#000000']],
        orderVector: [],
      },
      participants: {
        data: [['P0', 'P0'], ['P1', 'P1']],
        orderVector: [],
      },
      participantsGroups: [],
      stimuli: {
        data: [['S0', 'S0'], ['S1', 'S1']],
        orderVector: [],
      },
      noAoiTreatment: { displayedName: 'Outside', color: 'gray' },
    },
    getReader: () => reader,
    getAoiMapping: (_stimulusId: number, rawId: number) => rawId,
  }
}

describe('collectTransitionMetrics', () => {
  const mockAois = [
    { id: 1, displayedName: 'AOI 1' },
    { id: 2, displayedName: 'AOI 2' },
  ] as any

  it('should collect simple fixation transitions correctly', () => {
    const engine = createMockEngine([
      [],
      [
        [],
        [
          [0, 100, 0, 1],
          [100, 250, 0, 2],
          [250, 300, 0],
        ],
      ],
    ])

    const result = collectTransitionMetrics(engine as any, 1, [1], mockAois, 'fixation')
    const size = mockAois.length + 1

    expect(result.sumMatrix[0 * size + 1]).toBe(1)
    expect(result.dwellTimeMatrix[0 * size + 1]).toBe(100)
    expect(result.sumMatrix[1 * size + 2]).toBe(1)
    expect(result.dwellTimeMatrix[1 * size + 2]).toBe(150)
    expect(result.totalTransitions).toBe(2)
  })

  it('should handle visit mode correctly by merging consecutive AOIs', () => {
    const engine = createMockEngine([
      [],
      [
        [],
        [
          [0, 100, 0, 1],
          [100, 200, 0, 1],
          [200, 350, 0, 2],
        ],
      ],
    ])

    const result = collectTransitionMetrics(engine as any, 1, [1], mockAois, 'visit')
    const size = mockAois.length + 1

    expect(result.sumMatrix[0 * size + 1]).toBe(1)
    expect(result.dwellTimeMatrix[0 * size + 1]).toBe(200)
    expect(result.totalTransitions).toBe(1)
  })
})
