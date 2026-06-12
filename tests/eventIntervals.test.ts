/**
 * Derived interval channels — the strict-alternation pairing algorithm
 * (every error kind, the keep-first policy, both tie-breaks), suffix-pair
 * detection and proposals, draft previews (counts, errors, name rules),
 * the additive per-stimulus payloads (sources kept, display order
 * preserved, hidden ids remapped, optional source hiding), and the
 * Create-intervals step's inclusion rules.
 */

import { describe, expect, test } from 'vitest'
import {
  buildEventDataWithIntervalChannels,
  detectSuffixPair,
  INTERVAL_CHANNEL_MARKER,
  pairIntervalTimes,
  previewIntervalDrafts,
  proposePairsBySuffix,
} from '$lib/data/engine/eventIntervals'
import type { IntervalDraftPreview } from '$lib/data/engine/eventIntervals'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import {
  defaultManualName,
  reconcileDraftRows,
  rowIncludable,
} from '$lib/modals/modification/event-channel-modification/create-intervals/drafts'

function engineWith(eventData: {
  data: string[][][]
  events: number[][][][]
  orderVector?: number[][]
  hiddenChannels?: number[][]
}): DataEngine {
  return {
    metadata: {
      eventData,
      stimuli: { data: eventData.data.map((_, i) => [`S${i}`]) },
      participants: { data: [['P0'], ['P1']] },
    },
  } as unknown as DataEngine
}

describe('pairIntervalTimes — strict alternation', () => {
  test('pairs a single clean interval', () => {
    expect(pairIntervalTimes([1000], [2000])).toEqual({
      pairs: [[0, 0]],
      errors: [],
    })
  })

  test('pairs sequential intervals in order', () => {
    expect(pairIntervalTimes([1000, 3000], [2000, 4000])).toEqual({
      pairs: [
        [0, 0],
        [1, 1],
      ],
      errors: [],
    })
  })

  test('pairs nothing when both streams are empty', () => {
    expect(pairIntervalTimes([], [])).toEqual({ pairs: [], errors: [] })
  })

  test('double-start keeps the first open and reports the offender once', () => {
    expect(pairIntervalTimes([1000, 1500], [2000])).toEqual({
      pairs: [[0, 0]],
      errors: [{ kind: 'double-start', time: 1500 }],
    })
  })

  test('reports an end with no open start as an orphan', () => {
    expect(pairIntervalTimes([], [1000])).toEqual({
      pairs: [],
      errors: [{ kind: 'orphan-end', time: 1000 }],
    })
  })

  test('reports a start that never closes as unclosed', () => {
    expect(pairIntervalTimes([1000], [])).toEqual({
      pairs: [],
      errors: [{ kind: 'unclosed-start', time: 1000 }],
    })
  })

  test('an early end and a late start produce both error kinds', () => {
    expect(pairIntervalTimes([1000], [500])).toEqual({
      pairs: [],
      errors: [
        { kind: 'orphan-end', time: 500 },
        { kind: 'unclosed-start', time: 1000 },
      ],
    })
  })

  test('tie while open: the end closes first (back-to-back intervals)', () => {
    expect(pairIntervalTimes([1000, 2000], [2000, 3000])).toEqual({
      pairs: [
        [0, 0],
        [1, 1],
      ],
      errors: [],
    })
  })

  test('tie while closed: the start opens first (zero-length interval)', () => {
    expect(pairIntervalTimes([1000], [1000])).toEqual({
      pairs: [[0, 0]],
      errors: [],
    })
  })
})

describe('detectSuffixPair', () => {
  test('detects numeric suffix conventions among noise', () => {
    expect(
      detectSuffixPair([
        'task-0',
        'task-1',
        'music-0',
        'music-1',
        'phase-0',
        'phase-1',
        'Click',
        'Annotation',
      ])
    ).toEqual({ startSuffix: '-0', endSuffix: '-1' })
  })

  test('detects word suffix conventions', () => {
    expect(
      detectSuffixPair(['music start', 'music end', 'task start', 'task end'])
    ).toEqual({ startSuffix: ' start', endSuffix: ' end' })
  })

  test('detects underscore conventions', () => {
    expect(
      detectSuffixPair(['a_start', 'a_end', 'b_start', 'b_end'])
    ).toEqual({ startSuffix: '_start', endSuffix: '_end' })
  })

  test('a single matching pair is not enough to call it a convention', () => {
    expect(detectSuffixPair(['task-0', 'task-1', 'Click'])).toBeNull()
  })

  test('no convention yields null', () => {
    expect(detectSuffixPair(['Click', 'Annotation', 'Stray'])).toBeNull()
  })

  test('onsets orient the direction when end channels enumerate first', () => {
    // Without onsets the enumeration order would win and propose -1/-0.
    const onsets = new Map([
      ['task-0', 100],
      ['task-1', 900],
      ['music-0', 1200],
      ['music-1', 2000],
    ])
    expect(
      detectSuffixPair(['task-1', 'task-0', 'music-1', 'music-0'], onsets)
    ).toEqual({ startSuffix: '-0', endSuffix: '-1' })
  })

  test('onset voting flips the direction when the data says so', () => {
    // Enumeration suggests -0 starts, but every -1 occurrence comes first.
    const onsets = new Map([
      ['task-0', 900],
      ['task-1', 100],
      ['music-0', 2000],
      ['music-1', 1200],
    ])
    expect(
      detectSuffixPair(['task-0', 'task-1', 'music-0', 'music-1'], onsets)
    ).toEqual({ startSuffix: '-1', endSuffix: '-0' })
  })

  test('stems without onsets abstain from the direction vote', () => {
    // task has no occurrences (Infinity on both sides) — music decides.
    const onsets = new Map([
      ['task-0', Infinity],
      ['task-1', Infinity],
      ['music-0', 100],
      ['music-1', 500],
    ])
    expect(
      detectSuffixPair(['task-1', 'task-0', 'music-1', 'music-0'], onsets)
    ).toEqual({ startSuffix: '-0', endSuffix: '-1' })
  })
})

describe('proposePairsBySuffix', () => {
  const NAMES = [
    'task-0',
    'task-1',
    'music-0',
    'music-1',
    'baseline-0',
    'distractor-1',
    'Click',
  ]

  test('proposes one draft per fully matched stem, named by the stem', () => {
    const { proposals } = proposePairsBySuffix(NAMES, '-0', '-1')
    expect(proposals).toEqual([
      { name: 'task', startName: 'task-0', endName: 'task-1' },
      { name: 'music', startName: 'music-0', endName: 'music-1' },
    ])
  })

  test('reports one-sided matches instead of silently dropping them', () => {
    const { oneSided } = proposePairsBySuffix(NAMES, '-0', '-1')
    expect(oneSided).toEqual(['baseline-0', 'distractor-1'])
  })

  test('empty or identical suffixes propose nothing', () => {
    expect(proposePairsBySuffix(NAMES, '', '-1').proposals).toEqual([])
    expect(proposePairsBySuffix(NAMES, '-0', '-0').proposals).toEqual([])
  })
})

describe('previewIntervalDrafts', () => {
  const engine = () =>
    engineWith({
      data: [
        [
          ['A-0', 'A-0', '#aa0000'],
          ['A-1', 'A-1', '#00aa00'],
          ['B-0', 'B-0', '#888888'],
        ],
        [
          ['A-0', 'A-0', '#aa0000'],
          ['A-1', 'A-1', '#00aa00'],
        ],
      ],
      events: [
        [
          // S0: P0 has two clean A intervals; P1 one.
          [
            [10, 0, 50, 0],
            [5, 0],
          ],
          [
            [30, 0, 70, 0],
            [25, 0],
          ],
          [[100, 0], []],
        ],
        [
          // S1: P0 has an unclosed A start.
          [[200, 0]],
          [[]],
        ],
      ],
    })

  test('counts paired intervals across stimuli and participants', () => {
    const [preview] = previewIntervalDrafts(engine(), [
      { name: 'A', startName: 'A-0', endName: 'A-1' },
    ])
    expect(preview.pairedCount).toBe(3)
    expect(preview.skippedCount).toBe(1)
    expect(preview.errors).toEqual([
      {
        startChannel: 'A-0',
        endChannel: 'A-1',
        stimulus: 'S1',
        participant: 'P0',
        kind: 'unclosed-start',
        timeMs: 200,
      },
    ])
    expect(preview.nameError).toBeUndefined()
  })

  test('flags empty names, collisions with existing channels, and duplicates', () => {
    const previews = previewIntervalDrafts(engine(), [
      { name: '', startName: 'A-0', endName: 'A-1' },
      { name: 'B-0', startName: 'A-0', endName: 'A-1' },
      { name: 'same', startName: 'A-0', endName: 'A-1' },
      { name: 'same', startName: 'B-0', endName: 'A-1' },
    ])
    expect(previews[0].nameError).toMatch(/Name the new channel/)
    expect(previews[1].nameError).toMatch(/already exists/)
    expect(previews[2].nameError).toMatch(/another pair/)
    expect(previews[3].nameError).toMatch(/another pair/)
  })
})

describe('buildEventDataWithIntervalChannels', () => {
  const startEnd = () =>
    engineWith({
      data: [
        [
          ['music-0', 'music-0', '#aa0000'],
          ['Click', 'Click', '#888888'],
          ['music-1', 'music-1', '#00aa00'],
        ],
      ],
      events: [
        [
          [
            [30, 0, 120, 0],
            [10, 0],
          ],
          [[55, 0], []],
          [
            [90, 0, 180, 0],
            [40, 0],
          ],
        ],
      ],
    })

  test('appends the derived channel and keeps every source intact', () => {
    const updates = buildEventDataWithIntervalChannels(startEnd(), [
      { name: 'music', startName: 'music-0', endName: 'music-1' },
    ])
    expect(updates).toEqual([
      {
        stimulusId: 0,
        channelDefs: [
          ['music-0', 'music-0', '#aa0000'],
          ['Click', 'Click', '#888888'],
          ['music-1', 'music-1', '#00aa00'],
          // Derived channel appended last, start channel's color, tagged
          // with the marker so the step can list it for deletion.
          ['music', 'music', '#aa0000', INTERVAL_CHANNEL_MARKER],
        ],
        eventBuffers: [
          [
            [30, 0, 120, 0],
            [10, 0],
          ],
          [[55, 0], []],
          [
            [90, 0, 180, 0],
            [40, 0],
          ],
          [
            [30, 60, 120, 60],
            [10, 30],
          ],
        ],
        hiddenChannels: [],
      },
    ])
  })

  test('lenient by construction: clean intervals survive an unclosed start', () => {
    const engine = engineWith({
      data: [
        [
          ['A', 'A', '#888888'],
          ['B', 'B', '#888888'],
        ],
      ],
      // P0: 10→20 pairs cleanly, 50 never closes.
      events: [[[[10, 0, 50, 0]], [[20, 0]]]],
    })
    const [update] = buildEventDataWithIntervalChannels(engine, [
      { name: 'AB', startName: 'A', endName: 'B' },
    ])
    expect(update.eventBuffers[2]).toEqual([[10, 10]])
  })

  test('sorts unsorted buffers and pairs onsets of duration-bearing channels', () => {
    const engine = engineWith({
      data: [
        [
          ['A', 'A', '#888888'],
          ['B', 'B', '#888888'],
        ],
      ],
      // A carries durations (a previous derivation) — its ONSETS pair.
      events: [[[[120, 5, 30, 5]], [[180, 0, 90, 0]]]],
    })
    const [update] = buildEventDataWithIntervalChannels(engine, [
      { name: 'AB', startName: 'A', endName: 'B' },
    ])
    expect(update.eventBuffers[2]).toEqual([[30, 60, 120, 60]])
  })

  test('covers every stimulus where a source exists, skips uninvolved ones', () => {
    const engine = engineWith({
      data: [
        [
          ['A', 'A', '#888888'],
          ['B', 'B', '#888888'],
        ],
        [['Other', 'Other', '#888888']],
        // Start-only stimulus: the derived channel still appears (empty).
        [['A', 'A', '#888888']],
      ],
      events: [
        [[[10, 0]], [[20, 0]]],
        [[[5, 0]]],
        [[[]]],
      ],
    })
    const updates = buildEventDataWithIntervalChannels(engine, [
      { name: 'AB', startName: 'A', endName: 'B' },
    ])
    expect(updates.map(u => u.stimulusId)).toEqual([0, 2])
    expect(updates[0].eventBuffers[2]).toEqual([[10, 10]])
    expect(updates[1].channelDefs).toEqual([
      ['A', 'A', '#888888'],
      ['AB', 'AB', '#888888', INTERVAL_CHANNEL_MARKER],
    ])
    expect(updates[1].eventBuffers[1]).toEqual([[]])
  })

  test('preserves display order and remaps pre-existing hidden ids', () => {
    const engine = engineWith({
      data: [
        [
          ['A', 'A', '#888888'], // id 0
          ['Hidden', 'Hidden', '#888888'], // id 1, hidden
          ['B', 'B', '#888888'], // id 2
        ],
      ],
      events: [[[[10, 0]], [[50, 0]], [[20, 0]]]],
      // Custom display order: Hidden, B, A.
      orderVector: [[1, 2, 0]],
      hiddenChannels: [[1]],
    })
    const [update] = buildEventDataWithIntervalChannels(engine, [
      { name: 'AB', startName: 'A', endName: 'B' },
    ])
    expect(update.channelDefs).toEqual([
      ['Hidden', 'Hidden', '#888888'],
      ['B', 'B', '#888888'],
      ['A', 'A', '#888888'],
      ['AB', 'AB', '#888888', INTERVAL_CHANNEL_MARKER],
    ])
    // Old hidden id 1 → new 0; the sources stay visible — derivation
    // never hides anything.
    expect(update.hiddenChannels).toEqual([0])
  })

  test('payloads are deep copies, not views into engine state', () => {
    const engine = startEnd()
    const [update] = buildEventDataWithIntervalChannels(engine, [
      { name: 'music', startName: 'music-0', endName: 'music-1' },
    ])
    update.eventBuffers[1][0][0] = 999
    expect(engine.metadata!.eventData.events[0][1][0][0]).toBe(55)
  })

  test('throws on empty or duplicate draft names (programming error)', () => {
    expect(() =>
      buildEventDataWithIntervalChannels(startEnd(), [
        { name: ' ', startName: 'music-0', endName: 'music-1' },
      ])
    ).toThrow(/Invalid interval channel draft name/)
    expect(() =>
      buildEventDataWithIntervalChannels(startEnd(), [
        { name: 'x', startName: 'music-0', endName: 'music-1' },
        { name: 'x', startName: 'Click', endName: 'music-1' },
      ])
    ).toThrow(/Invalid interval channel draft name/)
  })
})

describe('Create-intervals step rules', () => {
  const preview = (
    overrides: Partial<IntervalDraftPreview>
  ): IntervalDraftPreview => ({
    draft: { name: 'x', startName: 'a', endName: 'b' },
    pairedCount: 5,
    skippedCount: 0,
    errors: [],
    ...overrides,
  })

  test('rowIncludable: clean rows are includable under both policies', () => {
    expect(rowIncludable(preview({}), 'skip')).toBe(true)
    expect(rowIncludable(preview({}), 'lenient')).toBe(true)
  })

  test('rowIncludable: rows with skips need the lenient policy', () => {
    expect(rowIncludable(preview({ skippedCount: 2 }), 'skip')).toBe(false)
    expect(rowIncludable(preview({ skippedCount: 2 }), 'lenient')).toBe(true)
  })

  test('rowIncludable: name errors and zero pairings always exclude', () => {
    expect(rowIncludable(preview({ nameError: 'taken' }), 'lenient')).toBe(
      false
    )
    expect(rowIncludable(preview({ pairedCount: 0 }), 'lenient')).toBe(false)
  })

  test('reconcileDraftRows replaces pattern rows and keeps manual ones', () => {
    const manual = {
      draft: { name: 'm', startName: 'a', endName: 'b' },
      origin: 'manual' as const,
      checked: true,
    }
    const stale = {
      draft: { name: 'old', startName: 'old-0', endName: 'old-1' },
      origin: 'pattern' as const,
      checked: false,
    }
    const next = reconcileDraftRows(
      [stale, manual],
      [{ name: 'new', startName: 'new-0', endName: 'new-1' }]
    )
    expect(next).toEqual([
      {
        draft: { name: 'new', startName: 'new-0', endName: 'new-1' },
        origin: 'pattern',
        checked: true,
      },
      manual,
    ])
  })

  test('defaultManualName trims the common prefix of separators', () => {
    expect(defaultManualName('music start', 'music end')).toBe('music')
    expect(defaultManualName('task-0', 'task-1')).toBe('task')
    expect(defaultManualName('phase_begin', 'phase_finish')).toBe('phase')
    expect(defaultManualName('Click', 'Done')).toBe('Click')
  })
})
