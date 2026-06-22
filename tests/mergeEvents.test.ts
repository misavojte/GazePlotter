/**
 * Unit tests for the kernel's event resolution rule (`mergeEvents`) — THE
 * single implementation that folds `EventContribution`s into
 * `DataType.eventData`. Pins: name resolution, '*' wildcard expansion,
 * channel dedup, drop-with-warning aggregation, capabilities flip, and the
 * orderVector/hiddenChannels bookkeeping.
 */

import { describe, expect, test } from 'vitest'
import { mergeEvents } from '$lib/data/ingest/kernel/sink'
import type { EventContribution } from '$lib/data/ingest/kernel/sink'
import type { DataType } from '$lib/data/types'

function makeData(stimuli: string[], participants: string[]): DataType {
  return {
    stimuli: { data: stimuli.map(name => [name, name]) },
    participants: { data: participants.map(name => [name, name]) },
    capabilities: { event: false },
    eventData: {
      data: stimuli.map(() => []),
      orderVector: [],
      hiddenChannels: [],
      events: stimuli.map(() => []),
    },
  } as unknown as DataType
}

function ev(partial: Partial<EventContribution>): EventContribution {
  return {
    stimulus: 'S1',
    participant: 'P1',
    channel: 'Click',
    start: 100,
    duration: 0,
    ...partial,
  }
}

describe('mergeEvents', () => {
  test('resolves names, builds channel layout, flips capability', () => {
    const data = makeData(['S1', 'S2'], ['P1', 'P2'])
    const warnings = mergeEvents(data, [
      ev({ start: 100, duration: 50, channel: 'Task' }),
    ])

    expect(warnings).toEqual([])
    expect(data.capabilities.event).toBe(true)
    expect(data.eventData.data[0]).toEqual([['Task', 'Task', '#888888']])
    expect(data.eventData.data[1]).toEqual([])
    // [stimulus][channel][participant] → stride-2 buffer
    expect(data.eventData.events[0][0][0]).toEqual([100, 50])
    expect(data.eventData.events[0][0][1]).toEqual([])
    expect(data.eventData.orderVector).toEqual([[0], []])
    expect(data.eventData.hiddenChannels).toEqual([[], []])
  })

  test('preserves duration 0 as discrete and custom color', () => {
    const data = makeData(['S1'], ['P1'])
    mergeEvents(data, [ev({ duration: 0, color: '#ff0000' })])

    expect(data.eventData.data[0][0]).toEqual(['Click', 'Click', '#ff0000'])
    expect(data.eventData.events[0][0][0]).toEqual([100, 0])
  })

  test("wildcard '*' applies the occurrence to every participant", () => {
    const data = makeData(['S1'], ['P1', 'P2', 'P3'])
    const warnings = mergeEvents(data, [
      ev({ participant: '*', start: 10, duration: 5 }),
    ])

    expect(warnings).toEqual([])
    for (let p = 0; p < 3; p++) {
      expect(data.eventData.events[0][0][p]).toEqual([10, 5])
    }
  })

  test('dedups channels by name within a stimulus, not across stimuli', () => {
    const data = makeData(['S1', 'S2'], ['P1'])
    mergeEvents(data, [
      ev({ start: 1 }),
      ev({ start: 2 }),
      ev({ stimulus: 'S2', start: 3 }),
    ])

    expect(data.eventData.data[0]).toHaveLength(1)
    expect(data.eventData.data[1]).toHaveLength(1)
    expect(data.eventData.events[0][0][0]).toEqual([1, 0, 2, 0])
    expect(data.eventData.events[1][0][0]).toEqual([3, 0])
  })

  test('drops unknown names and aggregates warnings per name', () => {
    const data = makeData(['S1'], ['P1'])
    const warnings = mergeEvents(data, [
      ev({ stimulus: 'Nope' }),
      ev({ stimulus: 'Nope' }),
      ev({ participant: 'Ghost' }),
      ev({ start: 7 }),
    ])

    expect(warnings).toEqual([
      "2 event(s) referenced unknown stimulus 'Nope'",
      "1 event(s) referenced unknown participant 'Ghost'",
    ])
    // The resolvable one still landed.
    expect(data.eventData.events[0][0][0]).toEqual([7, 0])
    expect(data.capabilities.event).toBe(true)
  })

  test('capability stays false when every contribution is dropped', () => {
    const data = makeData(['S1'], ['P1'])
    const warnings = mergeEvents(data, [ev({ stimulus: 'Nope' })])

    expect(warnings).toHaveLength(1)
    expect(data.capabilities.event).toBe(false)
    expect(data.eventData.data[0]).toEqual([])
  })
})
