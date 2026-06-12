/**
 * Event-channel selectors backing the Create-intervals step: the
 * cross-stimulus channel summary (names, counts, onsets, interval
 * marker) and the per-stimulus replacement payloads that drop channels
 * by original name (used to delete derived interval channels).
 */

import { describe, expect, test } from 'vitest'
import {
  buildEventDataWithoutChannels,
  getEventChannelSummary,
} from '$lib/data/engine/selectors/eventDataSelectors'
import { INTERVAL_CHANNEL_MARKER } from '$lib/data/engine/eventIntervals'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'

function engineWith(eventData: {
  data: string[][][]
  events: number[][][][]
  hiddenChannels?: number[][]
}): DataEngine {
  return { metadata: { eventData } } as unknown as DataEngine
}

const twoStimuli = () =>
  engineWith({
    data: [
      [
        ['Click', 'Click', '#888888'],
        ['Task', 'Task', '#888888'],
      ],
      [['Click', 'Click', '#888888']],
    ],
    events: [
      [
        // Click on S0: P0 has 2 occurrences, P1 has 1
        [
          [10, 0, 20, 0],
          [30, 0],
        ],
        // Task on S0: P0 has 1 occurrence
        [[100, 50], []],
      ],
      [
        // Click on S1: P1 has 1 occurrence
        [[], [5, 0]],
      ],
    ],
  })

describe('getEventChannelSummary', () => {
  test('aggregates by original name across stimuli', () => {
    expect(getEventChannelSummary(twoStimuli())).toEqual([
      {
        name: 'Click',
        stimulusCount: 2,
        occurrenceCount: 4,
        firstOnset: 5,
        isInterval: false,
      },
      {
        name: 'Task',
        stimulusCount: 1,
        occurrenceCount: 1,
        firstOnset: 100,
        isInterval: false,
      },
    ])
  })

  test('a channel with no occurrences reports an Infinity first onset', () => {
    expect(
      getEventChannelSummary(
        engineWith({ data: [[['Empty', 'Empty', '#888888']]], events: [[[]]] })
      )
    ).toEqual([
      {
        name: 'Empty',
        stimulusCount: 1,
        occurrenceCount: 0,
        firstOnset: Infinity,
        isInterval: false,
      },
    ])
  })

  test('flags derived interval channels via the def marker', () => {
    const summary = getEventChannelSummary(
      engineWith({
        data: [
          [
            ['task-0', 'task-0', '#888888'],
            ['task', 'task', '#888888', INTERVAL_CHANNEL_MARKER],
          ],
        ],
        events: [[[[1, 0]], [[1, 5]]]],
      })
    )
    expect(summary.map(entry => [entry.name, entry.isInterval])).toEqual([
      ['task-0', false],
      ['task', true],
    ])
  })

  test('empty engine yields empty summary', () => {
    expect(
      getEventChannelSummary(engineWith({ data: [[], []], events: [[], []] }))
    ).toEqual([])
  })
})

describe('buildEventDataWithoutChannels', () => {
  test('drops the named channel everywhere, omits untouched stimuli', () => {
    const updates = buildEventDataWithoutChannels(
      twoStimuli(),
      new Set(['Task'])
    )
    expect(updates).toEqual([
      {
        stimulusId: 0,
        channelDefs: [['Click', 'Click', '#888888']],
        eventBuffers: [
          [
            [10, 0, 20, 0],
            [30, 0],
          ],
        ],
        hiddenChannels: [],
      },
    ])
  })

  test('hidden ids are remapped to the new indexing, removed ids dropped', () => {
    const engine = engineWith({
      data: [
        [
          ['task-0', 'task-0', '#888888'],
          ['Click', 'Click', '#888888'],
          ['task-1', 'task-1', '#888888'],
          ['task', 'task', '#888888'],
        ],
      ],
      events: [[[[]], [[]], [[]], [[]]]],
      // Click (1) and task-1 (2) hidden; Click is being removed.
      hiddenChannels: [[1, 2]],
    })
    const [update] = buildEventDataWithoutChannels(engine, new Set(['Click']))
    expect(update.channelDefs.map(def => def[0])).toEqual([
      'task-0',
      'task-1',
      'task',
    ])
    // task-1 stays hidden under its new id (2 → 1); Click's id is dropped.
    expect(update.hiddenChannels).toEqual([1])
  })

  test('removing a cross-stimulus channel updates every stimulus', () => {
    const updates = buildEventDataWithoutChannels(
      twoStimuli(),
      new Set(['Click'])
    )
    expect(updates.map(u => u.stimulusId)).toEqual([0, 1])
    expect(updates[0].channelDefs).toEqual([['Task', 'Task', '#888888']])
    expect(updates[1].channelDefs).toEqual([])
    expect(updates[1].eventBuffers).toEqual([])
  })

  test('unknown name produces no updates', () => {
    expect(
      buildEventDataWithoutChannels(twoStimuli(), new Set(['Nope']))
    ).toEqual([])
  })

  test('payloads are deep copies, not views into engine state', () => {
    const engine = twoStimuli()
    const [update] = buildEventDataWithoutChannels(engine, new Set(['Task']))
    update.eventBuffers[0][0][0] = 999
    expect(engine.metadata!.eventData.events[0][0][0][0]).toBe(10)
  })
})
