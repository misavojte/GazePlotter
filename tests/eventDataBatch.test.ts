/**
 * Engine-owned invariants of updateEventDataBatch: replacing a stimulus's
 * channel defs invalidates every id referring into them, so the hidden
 * list is cleared and the order vector falls back to identity unless the
 * update carries an order valid for the NEW defs. Callers that want
 * hidden state to survive must supply remapped ids (via the command's
 * hiddenChannels, applied after the batch).
 */

import { describe, expect, test } from 'vitest'
import { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { INTERVAL_CHANNEL_MARKER } from '$lib/data/engine/eventIntervals'

const NEW_DEFS = [
  ['A', 'A', '#111111'],
  ['B', 'B', '#222222'],
]
const NEW_BUFFERS = [[[10, 0]], [[20, 0]]]

function engineWithEventState(): DataEngine {
  const engine = new DataEngine()
  engine.metadata = {
    capabilities: { segmented: false, spatial: false, event: false },
    eventData: {
      data: [
        [
          ['X', 'X', '#888888'],
          ['Y', 'Y', '#888888'],
          ['Z', 'Z', '#888888'],
        ],
      ],
      events: [[[[1, 0]], [[2, 0]], [[3, 0]]]],
      orderVector: [[2, 0, 1]],
      hiddenChannels: [[0, 2]],
    },
  } as unknown as DataEngine['metadata']
  return engine
}

describe('updateEventDataBatch', () => {
  test('replacement clears hidden ids and resets order to identity', () => {
    const engine = engineWithEventState()
    engine.updateEventDataBatch([
      {
        stimulusId: 0,
        channelDefs: NEW_DEFS.map(def => [...def]),
        eventBuffers: NEW_BUFFERS,
      },
    ])
    const ed = engine.metadata!.eventData
    expect(ed.hiddenChannels![0]).toEqual([])
    expect(ed.orderVector![0]).toEqual([0, 1])
  })

  test('a supplied order vector valid for the new defs is applied', () => {
    const engine = engineWithEventState()
    engine.updateEventDataBatch([
      {
        stimulusId: 0,
        channelDefs: NEW_DEFS.map(def => [...def]),
        eventBuffers: NEW_BUFFERS,
        orderVector: [1, 0],
      },
    ])
    expect(engine.metadata!.eventData.orderVector![0]).toEqual([1, 0])
  })

  test('an order vector of the wrong length falls back to identity', () => {
    const engine = engineWithEventState()
    engine.updateEventDataBatch([
      {
        stimulusId: 0,
        channelDefs: NEW_DEFS.map(def => [...def]),
        eventBuffers: NEW_BUFFERS,
        orderVector: [2, 0, 1],
      },
    ])
    expect(engine.metadata!.eventData.orderVector![0]).toEqual([0, 1])
  })
})

describe('updateEventChannelsBatch', () => {
  test('preserves def elements beyond [original, displayed, color]', () => {
    const engine = engineWithEventState()
    // Z is a derived interval channel; renaming must keep the marker.
    engine.metadata!.eventData.data[0][2].push(INTERVAL_CHANNEL_MARKER)
    engine.updateEventChannelsBatch([
      {
        stimulusId: 0,
        channels: [
          {
            id: 2,
            originalName: 'Z',
            displayedName: 'Renamed Z',
            color: '#123456',
          },
          { id: 0, originalName: 'X', displayedName: 'X', color: '#888888' },
          { id: 1, originalName: 'Y', displayedName: 'Y', color: '#888888' },
        ],
      },
    ])
    expect(engine.metadata!.eventData.data[0][2]).toEqual([
      'Z',
      'Renamed Z',
      '#123456',
      INTERVAL_CHANNEL_MARKER,
    ])
    expect(engine.metadata!.eventData.data[0][0]).toEqual([
      'X',
      'X',
      '#888888',
    ])
  })
})
