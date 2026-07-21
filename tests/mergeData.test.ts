import { describe, it, expect } from 'vitest'
import { planDisplayedNameMerges } from '$lib/data/merge/planMerges'
import { detectMergeOverlap } from '$lib/data/merge/detectOverlap'
import {
  foldParticipantMerge,
  unfoldParticipantMerge,
  type ParticipantFoldable,
} from '$lib/data/merge/mergeFold'
import { mergeStimuli, unmergeStimuli } from '$lib/data/merge/mergeStimuli'
import {
  mergeParticipants,
  unmergeParticipants,
} from '$lib/data/merge/mergeParticipants'
import { foldMerges, unfoldMerges } from '$lib/data/merge/applyMerges'
import { jsonSegmentsToBinary, BinaryBufferReader } from '$lib/data/binary'
import { generateWorkspaceJson } from '$lib/data/export/mappers/workspace'
import { processJsonFileWithGrid } from '$lib/data/ingest/workspace/parser'
import {
  CURRENT_SCHEMA_VERSION,
  type DataType,
  type MergeLogEntry,
} from '$lib/data/types'
import {
  makeDataType,
  nestedSegments,
  normalizeSegments as norm,
} from './helpers/dataTypeFixtures'

// ============================================================================
// 1. planDisplayedNameMerges Tests
// ============================================================================
describe('planDisplayedNameMerges', () => {
  it('returns no merges when all displayed names are unique', () => {
    expect(
      planDisplayedNameMerges([
        { id: 0, displayedName: 'A' },
        { id: 1, displayedName: 'B' },
      ])
    ).toEqual([])
  })

  it('plans a merge for a displayed-name collision (first in order is representative)', () => {
    expect(
      planDisplayedNameMerges([
        { id: 0, displayedName: 'Stimulus A' },
        { id: 1, displayedName: 'Stimulus A' }, // renamed to collide -> folds into id 0
        { id: 2, displayedName: 'Other' },
      ])
    ).toEqual([{ representativeId: 0, memberIds: [1] }])
  })

  it('plans one merge per collision group and never merges empty names', () => {
    expect(
      planDisplayedNameMerges([
        { id: 0, displayedName: 'X' },
        { id: 1, displayedName: 'Y' },
        { id: 2, displayedName: 'X' },
        { id: 3, displayedName: 'Y' },
        { id: 4, displayedName: '' },
        { id: 5, displayedName: '' },
      ])
    ).toEqual([
      { representativeId: 0, memberIds: [2] },
      { representativeId: 1, memberIds: [3] },
    ])
  })
})

// ============================================================================
// 2. detectMergeOverlap Tests
// ============================================================================
// 2 stimuli x 3 participants.
//   s0: p0, p2 have data;  s1: p1, p2 have data
const createOverlapReader = () =>
  new BinaryBufferReader(
    jsonSegmentsToBinary([
      [[[0, 1, 0]], [], [[2, 3, 0]]],
      [[], [[4, 5, 0]], [[6, 7, 0]]],
    ])
  )

describe('detectMergeOverlap', () => {
  it('participant merge of a disjoint pair returns no conflicts', () => {
    // p0 (s0 only) + p1 (s1 only) are disjoint.
    expect(detectMergeOverlap(createOverlapReader(), 'participant', 0, [1])).toEqual([])
  })

  it('participant merge flags the stimulus where both have data', () => {
    // p0 (s0) + p2 (s0 and s1): they collide on s0.
    expect(detectMergeOverlap(createOverlapReader(), 'participant', 0, [2])).toEqual([0])
  })

  it('stimulus merge of a disjoint pair returns no conflicts', () => {
    const r = new BinaryBufferReader(
      jsonSegmentsToBinary([
        [[[0, 1, 0]], []],
        [[], [[4, 5, 0]]],
      ])
    )
    expect(detectMergeOverlap(r, 'stimulus', 0, [1])).toEqual([])
  })

  it('stimulus merge flags the participant present on both stimuli', () => {
    // s0 and s1 both have p2 -> conflict on participant 2.
    expect(detectMergeOverlap(createOverlapReader(), 'stimulus', 0, [1])).toEqual([2])
  })

  it('n-way: reports every conflicting counterpart', () => {
    const r = new BinaryBufferReader(
      jsonSegmentsToBinary([
        [[[0, 1, 0]], [[1, 2, 0]]], // s0: p0, p1
        [[[2, 3, 0]], []], // s1: p0
        [[], [[3, 4, 0]]], // s2: p1
      ])
    )
    expect(detectMergeOverlap(r, 'stimulus', 0, [1, 2]).sort()).toEqual([0, 1])
  })
})

// ============================================================================
// 3. participant-axis fold Tests (mergeFold)
// ============================================================================
const createFoldableDataset = (): ParticipantFoldable => ({
  participants: {
    data: [
      ['P0', 'P0'],
      ['P1', 'P1 (copy)'],
      ['P2', 'P2'],
    ],
    orderVector: [0, 1, 2],
  },
  segments: [
    // stimulus 0
    [
      [], // p0 — empty
      [[0, 100, 0, 5]], // p1 — one fixation hitting AOI 5
      [[0, 50, 0]], // p2
    ],
    // stimulus 1
    [
      [[200, 300, 0, 7]], // p0
      [], // p1 — empty
      [[10, 20, 0]], // p2
    ],
  ],
})

const createFoldableDatasetWithSpatial = (): ParticipantFoldable => ({
  ...createFoldableDataset(),
  spatialData: [
    [[], [[11, 22]], [[1, 2]]],
    [[[33, 44]], [], [null]],
  ],
})

describe('participant-axis fold', () => {
  it('folds a disjoint member into the representative and tombstones it', () => {
    const src = createFoldableDataset()
    const { dataset, entry } = foldParticipantMerge(src, 0, [1], 1000)

    expect(dataset.segments[0][0]).toEqual([[0, 100, 0, 5]])
    expect(dataset.segments[0][1]).toEqual([])
    expect(dataset.segments[1][0]).toEqual([[200, 300, 0, 7]])
    expect(dataset.segments[0][2]).toEqual([[0, 50, 0]])

    expect(dataset.participants.orderVector).toEqual([0, 2])
    expect(dataset.participants.data[1]).toEqual(['P1', 'P1 (copy)'])

    expect(entry).toMatchObject({
      op: 'merge',
      axis: 'participant',
      representativeId: 0,
      at: 1000,
    })
    expect(entry.members).toHaveLength(1)
    expect(entry.members[0]).toMatchObject({
      id: 1,
      displayedName: 'P1 (copy)',
      orderIndex: 1,
      contributedCounterparts: [0],
    })
  })

  it('does not mutate the input dataset', () => {
    const src = createFoldableDataset()
    const snapshot = structuredClone(src)
    foldParticipantMerge(src, 0, [1], 1000)
    expect(src).toEqual(snapshot)
  })

  it('throws on overlap (both participants have data on the same stimulus)', () => {
    const src = createFoldableDataset()
    src.segments[1][1] = [[210, 260, 0]]
    expect(() => foldParticipantMerge(src, 0, [1], 1000)).toThrow(/disjoint/)
  })
})

describe('participant-axis fold/unfold round-trip (lossless reversibility)', () => {
  it('unfold(fold(x)) === x — segments only', () => {
    const src = createFoldableDataset()
    const { dataset, entry } = foldParticipantMerge(src, 0, [1], 1000)
    const restored = unfoldParticipantMerge(dataset, entry)
    expect(restored).toEqual(createFoldableDataset())
  })

  it('unfold(fold(x)) === x — with spatial data', () => {
    const src = createFoldableDatasetWithSpatial()
    const { dataset, entry } = foldParticipantMerge(src, 0, [1], 1000)
    const restored = unfoldParticipantMerge(dataset, entry)
    expect(restored).toEqual(createFoldableDatasetWithSpatial())
  })

  it('handles an n-way merge (two members into one representative)', () => {
    const src: ParticipantFoldable = {
      participants: {
        data: [
          ['P0', 'A'],
          ['P1', 'A (1)'],
          ['P2', 'A (2)'],
        ],
        orderVector: [0, 1, 2],
      },
      segments: [
        [[[0, 1, 0]], [], []],
        [[], [[2, 3, 0]], []],
        [[], [], [[4, 5, 0]]],
      ],
    }
    const before = structuredClone(src)
    const { dataset, entry } = foldParticipantMerge(src, 0, [1, 2], 5)

    expect(dataset.segments[0][0]).toEqual([[0, 1, 0]])
    expect(dataset.segments[1][0]).toEqual([[2, 3, 0]])
    expect(dataset.segments[2][0]).toEqual([[4, 5, 0]])
    expect(dataset.participants.orderVector).toEqual([0])
    expect(entry.members.map(m => m.id)).toEqual([1, 2])

    expect(unfoldParticipantMerge(dataset, entry)).toEqual(before)
  })

  it('restores order-vector positions for members that were not last', () => {
    const src: ParticipantFoldable = {
      participants: {
        data: [['0', '0'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']],
        orderVector: [0, 1, 2, 3, 4],
      },
      segments: [
        [[], [[0, 1, 0]], [], [], []],
        [[], [], [], [[2, 3, 0]], []],
        [[], [], [[4, 5, 0]], [], []],
      ],
      spatialData: undefined,
    }
    const before = structuredClone(src)
    const { dataset, entry } = foldParticipantMerge(src, 2, [1, 3], 7)
    expect(dataset.participants.orderVector).toEqual([0, 2, 4])
    expect(unfoldParticipantMerge(dataset, entry).participants.orderVector).toEqual([
      0, 1, 2, 3, 4,
    ])
    expect(unfoldParticipantMerge(dataset, entry)).toEqual(before)
  })
})

// ============================================================================
// 4. mergeStimuli / unmergeStimuli Tests
// ============================================================================
const buildStimulusMergeData = (
  aoisData: string[][][],
  segments: number[][][][],
  over: Partial<DataType> = {}
): DataType =>
  makeDataType(segments, {
    stimuli: { data: [['R', 'R'], ['M', 'M (copy)']], orderVector: [0, 1] },
    participants: { data: [['p0', 'p0'], ['p1', 'p1']], orderVector: [0, 1] },
    aois: {
      data: aoisData,
      orderVector: aoisData.map(rows => rows.map((_, i) => i)),
    },
    ...over,
  })

describe('mergeStimuli / unmergeStimuli', () => {
  it('folds a member stimulus into the representative (matching AOI dicts)', () => {
    const src = buildStimulusMergeData(
      [
        [['Logo', 'Logo', '#f00']],
        [['Logo', 'Logo', '#0f0']],
      ],
      [
        [[[0, 100, 0, 0]], []],
        [[], [[5, 50, 0, 0]]],
      ]
    )

    const merged = mergeStimuli(src, 0, [1], 9)
    const nested = nestedSegments(merged)

    expect(nested[0][0]).toEqual([[0, 100, 0, 0]])
    expect(nested[0][1]).toEqual([[5, 50, 0, 0]])
    expect(nested[1][0]).toEqual([])
    expect(nested[1][1]).toEqual([])

    expect(merged.stimuli.orderVector).toEqual([0])
    expect(merged.aois.data[0]).toEqual([['Logo', 'Logo', '#f00']])
    expect(merged.merges).toHaveLength(1)

    expect(norm(unmergeStimuli(merged, merged.merges![0]))).toEqual(norm(src))
  })

  it('appends a member-only AOI to the representative and remaps ids, reversibly', () => {
    const src = buildStimulusMergeData(
      [
        [['Logo', 'Logo', '#f00']],
        [
          ['Logo', 'Logo', '#0f0'],
          ['Text', 'Text', '#00f'],
        ],
      ],
      [
        [[[0, 100, 0, 0]], []],
        [[], [[5, 50, 0, 1]]],
      ]
    )

    const merged = mergeStimuli(src, 0, [1], 9)
    expect(merged.aois.data[0]).toEqual([
      ['Logo', 'Logo', '#f00'],
      ['Text', 'Text', '#00f'],
    ])
    expect(merged.aois.orderVector[0]).toEqual([0, 1])
    expect(nestedSegments(merged)[0][1]).toEqual([[5, 50, 0, 1]])

    expect(norm(unmergeStimuli(merged, merged.merges![0]))).toEqual(norm(src))
  })

  it('folds and restores event occurrences across the stimulus merge', () => {
    const src = buildStimulusMergeData(
      [[['Logo', 'Logo', '#f00']], [['Logo', 'Logo', '#0f0']]],
      [
        [[[0, 100, 0, 0]], []],
        [[], [[5, 50, 0, 0]]],
      ],
      {
        capabilities: { segmented: true, spatial: false, event: true },
        eventData: {
          data: [[['C', 'C', '#111']], [['C', 'C', '#222']]],
          orderVector: [[0], [0]],
          events: [
            [[[], []]],
            [[[], [70, 4]]],
          ],
        },
      }
    )

    const merged = mergeStimuli(src, 0, [1], 9)
    expect(merged.eventData.events[0][0][1]).toEqual([70, 4])
    expect(merged.eventData.events[1][0][1]).toEqual([])
    expect(merged.merges![0].members[0].stimulusEventContributions).toEqual([
      { memberChannel: 0, participant: 1, boundary: 0 },
    ])

    expect(norm(unmergeStimuli(merged, merged.merges![0]))).toEqual(norm(src))
  })

  it('restores occurrences when two member channels reconcile to one (LIFO)', () => {
    // Member stimulus 1 carries TWO channels sharing the displayed name "C",
    // so both fold onto the rep's single "C" cell — the un-fold must unwind
    // them LIFO.
    const src = buildStimulusMergeData(
      [[['Logo', 'Logo', '#f00']], [['Logo', 'Logo', '#0f0']]],
      [
        [[[0, 100, 0, 0]], []],
        [[], [[5, 50, 0, 0]]],
      ],
      {
        capabilities: { segmented: true, spatial: false, event: true },
        eventData: {
          data: [
            [['C', 'C', '#111']],
            [['C', 'C', '#a1'], ['C', 'C', '#b2']],
          ],
          orderVector: [[0], [0, 1]],
          events: [
            [[[], []]],
            [[[70, 4], []], [[80, 6], []]],
          ],
        },
      }
    )

    const merged = mergeStimuli(src, 0, [1], 9)
    // Both member channels' occurrences stacked onto the one rep channel/cell.
    expect(merged.eventData.events[0][0][0]).toEqual([70, 4, 80, 6])
    expect(merged.merges![0].members[0].stimulusEventContributions).toEqual([
      { memberChannel: 0, participant: 0, boundary: 0 },
      { memberChannel: 1, participant: 0, boundary: 2 },
    ])

    expect(norm(unmergeStimuli(merged, merged.merges![0]))).toEqual(norm(src))
  })

  it('throws on a non-disjoint stimulus merge', () => {
    const src = buildStimulusMergeData(
      [[['Logo', 'Logo', '#f00']], [['Logo', 'Logo', '#0f0']]],
      [
        [[[0, 100, 0, 0]], []],
        [[[1, 2, 0, 0]], [[5, 50, 0, 0]]],
      ]
    )
    expect(() => mergeStimuli(src, 0, [1], 9)).toThrow(/disjoint/)
  })
})

// ============================================================================
// 5. mergeParticipants / unmergeParticipants Tests (mergeParticipants.ts)
// ============================================================================
const createParticipantMergeData = (): DataType =>
  makeDataType(
    [
      [[], [[0, 100, 0, 0]], [[0, 50, 0]]],
      [[[200, 300, 0, 0]], [], [[10, 20, 0]]],
    ],
    {
      participants: {
        data: [
          ['P0', 'P0'],
          ['P1', 'P1 (copy)'],
          ['P2', 'P2'],
        ],
        orderVector: [0, 1, 2],
      },
      participantsSelections: [
        { id: 1, name: 'Group A', participantsIds: [1, 2] },
        { id: 2, name: 'Group B', participantsIds: [2] },
      ],
    }
  )

describe('mergeParticipants / unmergeParticipants', () => {
  it('folds the member into the representative, tombstones it, and remaps groups', () => {
    const merged = mergeParticipants(createParticipantMergeData(), 0, [1], 42)
    const nested = nestedSegments(merged)

    expect(nested[0][0]).toEqual([[0, 100, 0, 0]])
    expect(nested[0][1]).toEqual([])
    expect(nested[1][0]).toEqual([[200, 300, 0, 0]])

    expect(merged.participants.orderVector).toEqual([0, 2])
    expect(merged.participants.data[1]).toEqual(['P1', 'P1 (copy)'])

    expect(merged.participantsSelections[0].participantsIds).toEqual([0, 2])
    expect(merged.participantsSelections[1].participantsIds).toEqual([2])

    expect(merged.merges).toHaveLength(1)
    expect(merged.merges![0].participantsSelectionsBefore).toEqual([
      { id: 1, participantsIds: [1, 2] },
    ])
  })

  it('does not mutate the input DataType', () => {
    const src = createParticipantMergeData()
    const before = norm(src)
    mergeParticipants(src, 0, [1], 42)
    expect(norm(src)).toEqual(before)
  })

  it('unmerge(merge(x)) === x (segments, order vector, groups, and log)', () => {
    const src = createParticipantMergeData()
    const merged = mergeParticipants(src, 0, [1], 42)
    const restored = unmergeParticipants(merged, merged.merges![0])
    expect(norm(restored)).toEqual(norm(src))
  })

  it('folds a member participant event occurrences into the representative and restores them', () => {
    const src: DataType = {
      ...createParticipantMergeData(),
      eventData: {
        data: [[['C', 'C', '#111']], [['C', 'C', '#111']]],
        orderVector: [[0], [0]],
        events: [
          [[[], [10, 5], [20, 3]]],
          [[[100, 8], [], [200, 2]]],
        ],
      },
    }

    const merged = mergeParticipants(src, 0, [1], 42)
    expect(merged.eventData.events[0][0][0]).toEqual([10, 5])
    expect(merged.eventData.events[0][0][1]).toEqual([])
    expect(merged.eventData.events[1][0][0]).toEqual([100, 8])
    expect(merged.eventData.events[0][0][2]).toEqual([20, 3])
    expect(merged.merges![0].members[0].eventContributions).toEqual([
      { stimulus: 0, channel: 0, boundary: 0 },
    ])

    const restored = unmergeParticipants(merged, merged.merges![0])
    expect(restored.eventData.events).toEqual(src.eventData.events)
    expect(norm(restored)).toEqual(norm(src))
  })

  it('restores per-participant events when several members share a channel (LIFO)', () => {
    // The event store sits outside the segment-disjointness gate: P0, P1 and
    // P2 all have occurrences on the same (stimulus, channel), so the fold
    // stacks all three onto the rep — the un-fold must unwind LIFO.
    const src: DataType = {
      ...makeDataType([
        [[[0, 100, 0, 0]], [], []],
        [[], [], []],
      ]),
      eventData: {
        data: [[['C', 'C', '#111']], [['C', 'C', '#111']]],
        orderVector: [[0], [0]],
        events: [
          [[[10, 5], [20, 3], [30, 7]]],
          [[[], [], []]],
        ],
      },
    }

    const merged = mergeParticipants(src, 0, [1, 2], 42)
    // Representative absorbed all three participants' buffers, in member order.
    expect(merged.eventData.events[0][0][0]).toEqual([10, 5, 20, 3, 30, 7])
    expect(merged.eventData.events[0][0][1]).toEqual([])
    expect(merged.eventData.events[0][0][2]).toEqual([])

    const restored = unmergeParticipants(merged, merged.merges![0])
    expect(restored.eventData.events).toEqual(src.eventData.events)
    expect(norm(restored)).toEqual(norm(src))
  })

  it('throws on a non-disjoint (overlapping) merge rather than losing data', () => {
    const src = createParticipantMergeData()
    const withOverlap: DataType = {
      ...src,
      segments: jsonSegmentsToBinary([
        [[], [[0, 100, 0, 0]], [[0, 50, 0]]],
        [[[200, 300, 0, 0]], [[210, 250, 0]], [[10, 20, 0]]],
      ]),
    }
    expect(() => mergeParticipants(withOverlap, 0, [1], 42)).toThrow(/disjoint/)
  })
})

// ============================================================================
// 6. foldMerges / unfoldMerges Tests (applyMerges)
// ============================================================================
const createApplyMergesBase = (): DataType =>
  makeDataType([
    [[[0, 10, 0, 0]], [], [[1, 9, 0, 0]], []],
    [[], [[0, 8, 0, 0]], [], [[2, 7, 0, 0]]],
  ])

describe('foldMerges / unfoldMerges (original-on-disk persistence)', () => {
  it('empty log is a no-op both ways', () => {
    const src = createApplyMergesBase()
    expect(foldMerges(src)).toBe(src)
    expect(unfoldMerges(src)).toBe(src)
  })

  it('single participant merge: unfold restores original data + keeps the log; fold re-derives', () => {
    const merged = mergeParticipants(createApplyMergesBase(), 0, [1], 1)
    const back = unfoldMerges(merged)

    expect(nestedSegments(back)).toEqual(nestedSegments(createApplyMergesBase()))
    expect(back.participants.orderVector).toEqual([0, 1, 2, 3])
    expect(back.merges).toEqual(merged.merges)

    expect(norm(foldMerges(back))).toEqual(norm(merged))
  })

  it('single stimulus merge round-trips through fold/unfold', () => {
    const merged = mergeStimuli(createApplyMergesBase(), 0, [1], 1)
    const back = unfoldMerges(merged)
    expect(nestedSegments(back)).toEqual(nestedSegments(createApplyMergesBase()))
    expect(back.stimuli.orderVector).toEqual([0, 1])
    expect(norm(foldMerges(back))).toEqual(norm(merged))
  })

  it('multi-entry log (two independent participant merges) folds/unfolds exactly', () => {
    const merged = mergeParticipants(mergeParticipants(createApplyMergesBase(), 0, [1], 1), 2, [3], 2)
    expect(merged.merges).toHaveLength(2)
    expect(merged.participants.orderVector).toEqual([0, 2])

    const back = unfoldMerges(merged)
    expect(nestedSegments(back)).toEqual(nestedSegments(createApplyMergesBase()))
    expect(back.participants.orderVector).toEqual([0, 1, 2, 3])

    expect(norm(foldMerges(back))).toEqual(norm(merged))
  })

  const createApplyMergesWithEvents = (): DataType =>
    makeDataType(
      [
        [[[0, 10, 0, 0]], []],
        [[], [[0, 8, 0, 0]]],
      ],
      {
        eventData: {
          data: [[], [['blink', 'blink', '#000000']]],
          orderVector: [[], [0]],
          events: [[], [[[], [100, 5]]]],
        },
      }
    )

  it('folds do not mutate the caller original (ownership contract)', () => {
    const original = createApplyMergesWithEvents()
    const eventsBefore = structuredClone(original.eventData.events)
    const segsBefore = nestedSegments(original)

    const merged = mergeParticipants(original, 0, [1], 1)
    expect(original.eventData.events).toEqual(eventsBefore)
    expect(nestedSegments(original)).toEqual(segsBefore)

    const withLog = unfoldMerges(merged)
    const logEventsBefore = structuredClone(withLog.eventData.events)
    const logSegsBefore = nestedSegments(withLog)
    foldMerges(withLog)
    expect(withLog.eventData.events).toEqual(logEventsBefore)
    expect(nestedSegments(withLog)).toEqual(logSegsBefore)

    expect(merged.eventData.events[1][0][0]).toEqual([100, 5])
    expect(merged.eventData.events[1][0][1]).toEqual([])
  })

  it('end-to-end: merge -> save (original-on-disk) -> reload -> re-derive merged', () => {
    const merged = mergeParticipants(createApplyMergesBase(), 0, [1], 1)
    const json = generateWorkspaceJson(unfoldMerges(merged), [], null)

    const raw = JSON.parse(json)
    expect(raw.data.participants.orderVector).toEqual([0, 1, 2, 3])
    expect(raw.data.merges).toHaveLength(1)

    const loaded = processJsonFileWithGrid(json)
    expect(loaded.data.participants.orderVector).toEqual([0, 1, 2, 3])
    const rederived = foldMerges(loaded.data)

    expect(rederived.participants.orderVector).toEqual([0, 2, 3])
    expect(nestedSegments(rederived)).toEqual(nestedSegments(merged))
  })
})

// ============================================================================
// 7. merges Log Persistence Tests (mergePersistence)
// ============================================================================
const persistenceMerges: MergeLogEntry[] = [
  {
    op: 'merge',
    axis: 'participant',
    representativeId: 0,
    members: [
      {
        id: 1,
        displayedName: 'Participant A (copy)',
        orderIndex: 1,
        contributedCounterparts: [0],
      },
    ],
    at: 1234567890,
  },
]

const createDataWithMerges = (): DataType =>
  makeDataType([[[[0, 100, 0, 0]], []]], {
    stimuli: { data: [['Stimulus A', 'Stimulus A']], orderVector: [0] },
    participants: {
      data: [
        ['Participant A', 'Participant A'],
        ['Participant A (copy)', 'Participant A (copy)'],
      ],
      orderVector: [0],
    },
    merges: persistenceMerges,
  })

describe('merge log persistence (workspace JSON round-trip)', () => {
  it('serializes `merges` into the workspace JSON', () => {
    const parsed = JSON.parse(
      generateWorkspaceJson(createDataWithMerges(), [], null)
    )
    expect(parsed.version).toBe(CURRENT_SCHEMA_VERSION)
    expect(parsed.data.merges).toEqual(persistenceMerges)
  })

  it('preserves `merges` exactly through save -> load (export + import)', () => {
    const json = generateWorkspaceJson(createDataWithMerges(), [], null)
    const result = processJsonFileWithGrid(json)
    expect(result.data.merges).toEqual(persistenceMerges)
  })

  it('leaves `merges` absent for datasets that were never merged', () => {
    const data = createDataWithMerges()
    delete data.merges
    const result = processJsonFileWithGrid(generateWorkspaceJson(data, [], null))
    expect(result.data.merges).toBeUndefined()
  })
})
