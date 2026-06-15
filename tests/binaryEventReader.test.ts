/**
 * Binary event occurrence store — the event analogue of the segment binary
 * buffers. Verifies the json→binary build, zero-allocation subarray reads,
 * out-of-range guards, the cold-path reconstruction (getStimulusJson/toJson),
 * presence flags, and the per-channel summary helpers.
 */

import { describe, expect, test } from 'vitest'
import {
  EventBufferReader,
  jsonEventsToBinary,
} from '$lib/data/binary'

// Two stimuli; stride-2 [start, duration, ...] per (channel, participant).
// S0: Click (P0 two occurrences, P1 one), Task (P0 one). S1: Click (P1 one).
const sample = (): number[][][][] => [
  [
    [
      [10, 0, 20, 0],
      [30, 0],
    ],
    [[100, 50], []],
  ],
  [[[], [5, 0]]],
]

describe('jsonEventsToBinary', () => {
  test('packs occurrences contiguously with a correct index', () => {
    const buffers = jsonEventsToBinary(sample())
    expect(buffers.stimuliCount).toBe(2)
    expect(buffers.maxParticipants).toBe(2)
    // channelOffsets: S0 has 2 channels, S1 has 1 → [0, 2, 3].
    expect(Array.from(buffers.channelOffsets)).toEqual([0, 2, 3])
    // Every occurrence number is present, nothing duplicated or dropped.
    expect(buffers.occurrenceBuffer.length).toBe(4 + 2 + 2 + 0 + 0 + 2)
  })

  test('empty input yields a valid empty store', () => {
    const buffers = jsonEventsToBinary([])
    expect(buffers.stimuliCount).toBe(0)
    expect(buffers.maxParticipants).toBe(0)
    expect(buffers.occurrenceBuffer.length).toBe(0)
    expect(Array.from(buffers.channelOffsets)).toEqual([0])
  })
})

describe('EventBufferReader.getOccurrences', () => {
  test('returns the stride-2 buffer for a (stimulus, channel, participant)', () => {
    const reader = new EventBufferReader()
    reader.load(sample())
    expect(Array.from(reader.getOccurrences(0, 0, 0))).toEqual([10, 0, 20, 0])
    expect(Array.from(reader.getOccurrences(0, 0, 1))).toEqual([30, 0])
    expect(Array.from(reader.getOccurrences(0, 1, 0))).toEqual([100, 50])
    expect(Array.from(reader.getOccurrences(1, 0, 1))).toEqual([5, 0])
  })

  test('is a zero-allocation view into the shared buffer', () => {
    const reader = new EventBufferReader()
    reader.load(sample())
    const view = reader.getOccurrences(0, 0, 0)
    expect(view).toBeInstanceOf(Float32Array)
    // A view, not a copy: it shares the reader's backing ArrayBuffer.
    expect(view.buffer).toBe(reader.getOccurrences(0, 0, 1).buffer)
  })

  test('empty cells and out-of-range indices return an empty view', () => {
    const reader = new EventBufferReader()
    reader.load(sample())
    expect(reader.getOccurrences(0, 1, 1).length).toBe(0) // Task / P1 empty
    expect(reader.getOccurrences(1, 0, 0).length).toBe(0) // Click S1 / P0 empty
    expect(reader.getOccurrences(5, 0, 0).length).toBe(0) // stimulus oob
    expect(reader.getOccurrences(0, 9, 0).length).toBe(0) // channel oob
    expect(reader.getOccurrences(0, 0, 9).length).toBe(0) // participant oob
    expect(reader.getOccurrences(0, -1, 0).length).toBe(0)
  })
})

describe('EventBufferReader summaries', () => {
  test('channel counts, occurrence counts, and first onsets', () => {
    const reader = new EventBufferReader()
    reader.load(sample())
    expect(reader.getChannelCount(0)).toBe(2)
    expect(reader.getChannelCount(1)).toBe(1)
    // Click S0: 3 occurrences across P0 (2) + P1 (1).
    expect(reader.getChannelOccurrenceCount(0, 0)).toBe(3)
    expect(reader.getChannelOccurrenceCount(0, 1)).toBe(1)
    expect(reader.getChannelFirstOnset(0, 0)).toBe(10)
    expect(reader.getChannelFirstOnset(1, 0)).toBe(5)
  })

  test('a channel with no occurrences reports Infinity first onset', () => {
    const reader = new EventBufferReader()
    reader.load([[[[]]]])
    expect(reader.getChannelOccurrenceCount(0, 0)).toBe(0)
    expect(reader.getChannelFirstOnset(0, 0)).toBe(Infinity)
  })

  test('presence flags per stimulus and globally', () => {
    const reader = new EventBufferReader()
    reader.load(sample())
    expect(reader.presencePerStimulus()).toEqual([true, true])
    expect(reader.hasEventsForStimulus(0)).toBe(true)
    expect(reader.hasAnyEvents()).toBe(true)

    const empty = new EventBufferReader()
    empty.load([[[[]]], []])
    expect(empty.presencePerStimulus()).toEqual([false, false])
    expect(empty.hasAnyEvents()).toBe(false)
  })
})

describe('EventBufferReader reconstruction', () => {
  test('toJson round-trips a dense (per-participant) layout exactly', () => {
    // Dense = every channel carries maxParticipants buffers, the convention
    // the ingest/update path produces. Round-trip must be identity.
    const dense: number[][][][] = [
      [
        [
          [10, 0, 20, 0],
          [30, 0],
        ],
        [[100, 50], [200, 10]],
      ],
      [
        [
          [1, 2],
          [3, 4],
        ],
      ],
    ]
    const reader = new EventBufferReader()
    reader.load(dense)
    expect(reader.toJson()).toEqual(dense)
  })

  test('getStimulusJson reconstructs one stimulus', () => {
    const reader = new EventBufferReader()
    reader.load(sample())
    expect(reader.getStimulusJson(1)).toEqual([[[], [5, 0]]])
  })

  test('constructing directly from prebuilt buffers reads the same', () => {
    const reader = new EventBufferReader(jsonEventsToBinary(sample()))
    expect(Array.from(reader.getOccurrences(0, 1, 0))).toEqual([100, 50])
  })
})
