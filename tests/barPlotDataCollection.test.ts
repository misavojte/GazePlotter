import { describe, it, expect } from 'vitest'
import { createReaderFromJson } from '../src/lib/data/binary/converters'
import { collectParticipantBarMetrics } from '../src/lib/plots/bar/core/collector'

function createMockEngine(segments: number[][][][]) {
  const reader = createReaderFromJson(segments)

  return {
    metadata: {
      isOrdinalOnly: false,
      aois: {
        data: [[], [], [
          ['AOI 0', 'AOI 0', '#000000'],
          ['AOI 1', 'AOI 1', 'red'],
          ['AOI 2', 'AOI 2', 'blue'],
        ]],
        orderVector: [[], [], [1, 2]],
        dynamicVisibility: {},
        hiddenAois: [[], [], []],
      },
      categories: {
        data: [['Fixation', 'Fixation', '#000000']],
        orderVector: [],
      },
      participants: {
        data: [['P101', 'P101'], ['P102', 'P102'], ['P103', 'P103']],
        orderVector: [],
      },
      participantsGroups: [],
      stimuli: {
        data: [['S0', 'S0'], ['S1', 'S1'], ['S2', 'S2']],
        orderVector: [],
      },
      noAoiTreatment: { displayedName: 'Outside', color: 'gray' },
    },
    getReader: () => reader,
    getAoiMapping: (_stimulusId: number, rawId: number) => rawId,
  }
}

describe('Bar Plot Data Collection', () => {
  const stimulusId = 1
  const participantIds = [101]
  const aois = [
    { id: 1, displayedName: 'AOI 1', color: 'red' },
    { id: 2, displayedName: 'AOI 2', color: 'blue' },
  ] as any

  it('should collect basic dwell time and fixation counts', () => {
    const engine = createMockEngine([
      [],
      Array.from({ length: 102 }, (_, participantId) =>
        participantId === 101
          ? [
              [0, 100, 0, 1],
              [100, 300, 0, 1, 2],
              [300, 350, 0],
              [350, 500, 0, 2],
            ]
          : []
      ),
    ])

    const result = collectParticipantBarMetrics(engine as any, stimulusId, participantIds, aois)
    const p1 = result[0]

    expect(result).toHaveLength(1)
    expect(p1.dwellTime[0]).toBe(300)
    expect(p1.dwellTime[1]).toBe(350)
    expect(p1.dwellTime[2]).toBe(50)
    expect(p1.dwellTime[3]).toBe(500)
    expect(p1.fixationCount[0]).toBe(2)
    expect(p1.fixationCount[1]).toBe(2)
    expect(p1.fixationCount[2]).toBe(1)
    expect(p1.fixationCount[3]).toBe(4)
    expect(p1.entryCount[0]).toBe(1)
    expect(p1.entryCount[1]).toBe(2)
    expect(p1.entryCount[2]).toBe(1)
    expect(p1.entryCount[3]).toBe(4)
  })

  it('should treat consecutive segments in same AOI as one entry', () => {
    const engine = createMockEngine([
      [],
      Array.from({ length: 102 }, () => [] as number[][]),
    ])
    engine.getReader = () =>
      createReaderFromJson([
        [],
        Array.from({ length: 102 }, (_, participantId) =>
          participantId === 101
            ? [
                [0, 100, 0, 1],
                [100, 200, 0, 1],
                [200, 300, 0, 1],
              ]
            : []
        ),
      ])

    const result = collectParticipantBarMetrics(engine as any, stimulusId, participantIds, aois)
    const p1 = result[0]

    expect(p1.entryCount[0]).toBe(1)
    expect(p1.dwellTime[0]).toBe(300)
    expect(p1.dwellDurations[0]).toEqual([300])
  })

  it('should handle AOI overlap correctly (multiple AOIs in one segment)', () => {
    const engine = createMockEngine([
      [],
      Array.from({ length: 102 }, (_, participantId) =>
        participantId === 101 ? [[0, 100, 0, 1, 2]] : []
      ),
    ])

    const result = collectParticipantBarMetrics(engine as any, stimulusId, participantIds, aois)
    const p1 = result[0]

    expect(p1.dwellTime[0]).toBe(100)
    expect(p1.dwellTime[1]).toBe(100)
    expect(p1.entryCount[0]).toBe(1)
    expect(p1.entryCount[1]).toBe(1)
  })

  it('should correctly capture TTFF from the very first segment', () => {
    const engine = createMockEngine([
      [],
      Array.from({ length: 102 }, (_, participantId) =>
        participantId === 101 ? [[50, 100, 0, 1]] : []
      ),
    ])

    const result = collectParticipantBarMetrics(engine as any, stimulusId, participantIds, aois)
    const p1 = result[0]

    expect(p1.ttff[0]).toBe(50)
    expect(p1.ttff[3]).toBe(50)
  })

  it('should handle gaps (No AOI) in timeToFirstFixation', () => {
    const engine = createMockEngine([
      [],
      Array.from({ length: 102 }, (_, participantId) =>
        participantId === 101
          ? [
              [0, 50, 0],
              [50, 100, 0, 1],
            ]
          : []
      ),
    ])

    const result = collectParticipantBarMetrics(engine as any, stimulusId, participantIds, aois)
    const p1 = result[0]

    expect(p1.ttff[2]).toBe(0)
    expect(p1.ttff[0]).toBe(50)
    expect(p1.ttff[3]).toBe(0)
  })

  it('should handle participants with no data', () => {
    const engine = createMockEngine([
      [],
      Array.from({ length: 102 }, () => [] as number[][]),
    ])

    const result = collectParticipantBarMetrics(engine as any, stimulusId, participantIds, aois)

    expect(result).toHaveLength(1)
    expect(result[0].dwellTime.every(v => v === 0)).toBe(true)
    expect(result[0].ttff.every(v => v === -1)).toBe(true)
    expect(result[0].fixationCount.every(v => v === 0)).toBe(true)
  })

  it('should correctly aggregate multiple participants', () => {
    const engine = createMockEngine([
      [],
      Array.from({ length: 103 }, (_, participantId) => {
        if (participantId === 101) return [[0, 100, 0, 1]]
        if (participantId === 102) return [[0, 200, 0, 2]]
        return []
      }),
    ])

    const result = collectParticipantBarMetrics(
      engine as any,
      stimulusId,
      [101, 102],
      aois
    )

    expect(result).toHaveLength(2)
    expect(result[0].dwellTime[0]).toBe(100)
    expect(result[0].dwellTime[1]).toBe(0)
    expect(result[1].dwellTime[0]).toBe(0)
    expect(result[1].dwellTime[1]).toBe(200)
  })
})
