/**
 * Selectors backing the post-upload event prune: the cross-stimulus
 * channel summary and the per-stimulus replacement payloads that drop
 * channels by original name.
 */

import { describe, expect, test } from 'vitest'
import {
  buildEventDataWithoutChannels,
  getEventChannelSummary,
} from '$lib/data/engine/selectors/eventDataSelectors'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'

function engineWith(eventData: {
  data: string[][][]
  events: number[][][][]
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
      { name: 'Click', stimulusCount: 2, occurrenceCount: 4 },
      { name: 'Task', stimulusCount: 1, occurrenceCount: 1 },
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
      },
    ])
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
