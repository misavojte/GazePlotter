/**
 * Engine-level contract for the binary event store: loadDataset strips the
 * heavy occurrence buffers out of reactive `metadata` into a non-reactive
 * binary reader (mirroring how `segments` stay out of runes), reads come back
 * as zero-allocation Float32Array views, mutation rebuilds the store and
 * bumps `eventVersion`, and export reconstructs the serializable shape.
 */

import { describe, expect, test } from 'vitest'
import { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { getEventBuffer } from '$lib/data/engine/selectors/eventDataSelectors'
import type { DataType } from '$lib/data/types'

function datasetWithEvents(): DataType {
  return {
    isOrdinalOnly: false,
    capabilities: { segmented: false, spatial: false, event: true },
    stimuli: { data: [['S0'], ['S1']], orderVector: [] },
    participants: { data: [['P0'], ['P1']], orderVector: [] },
    participantsGroups: [],
    metricInstances: [],
    categories: { data: [], orderVector: [] },
    noAoiTreatment: { color: '#cccccc', displayedName: 'No AOI' },
    aois: { data: [[], []], orderVector: [], hiddenAois: [] },
    segments: {
      segmentBuffer: new Float32Array(0),
      indexTable: new Uint32Array(0),
      aoiPool: new Uint16Array(0),
      hasSpatialData: false,
      maxParticipants: 2,
      stimuliCount: 2,
    },
    eventData: {
      data: [[['Click', 'Click', '#888']], []],
      orderVector: [[0], []],
      hiddenChannels: [[], []],
      events: [
        [
          [
            [10, 0, 20, 0],
            [30, 0],
          ],
        ],
        [],
      ],
    },
  }
}

describe('DataEngine event ownership', () => {
  test('loadDataset moves occurrence buffers out of reactive metadata', () => {
    const engine = new DataEngine()
    engine.loadDataset(datasetWithEvents())
    // The heavy buffers must NOT live on the reactive proxy any more.
    expect(
      (engine.metadata!.eventData as Record<string, unknown>).events
    ).toBeUndefined()
    // Channel defs/order/hidden stay reactive.
    expect(engine.metadata!.eventData.data[0][0][0]).toBe('Click')
  })

  test('getEventBuffer returns a zero-allocation Float32Array view', () => {
    const engine = new DataEngine()
    engine.loadDataset(datasetWithEvents())
    const buf = getEventBuffer(engine, 0, 0, 0)
    expect(buf).toBeInstanceOf(Float32Array)
    expect(Array.from(buf!)).toEqual([10, 0, 20, 0])
    expect(getEventBuffer(engine, 0, 0, 1)).not.toBeNull()
    expect(getEventBuffer(engine, 1, 0, 0)).toBeNull() // S1 has no channels
  })

  test('eventsPerStimulus reflects the binary store', () => {
    const engine = new DataEngine()
    engine.loadDataset(datasetWithEvents())
    expect(engine.eventsPerStimulus).toEqual([true, false])
  })

  test('export reconstructs the serializable number[][][][] shape', () => {
    const engine = new DataEngine()
    engine.loadDataset(datasetWithEvents())
    expect(engine.getEventBuffersJson()).toEqual([
      [
        [
          [10, 0, 20, 0],
          [30, 0],
        ],
      ],
      [],
    ])
  })

  test('updateEventDataBatch rebuilds the store and bumps eventVersion', () => {
    const engine = new DataEngine()
    engine.loadDataset(datasetWithEvents())
    const before = engine.eventVersion

    engine.updateEventDataBatch([
      {
        stimulusId: 1,
        channelDefs: [['Key', 'Key', '#999']],
        eventBuffers: [[[], [99, 0]]],
      },
    ])

    expect(engine.eventVersion).toBeGreaterThan(before)
    // New stimulus-1 channel is readable from the binary store...
    expect(Array.from(getEventBuffer(engine, 1, 0, 1)!)).toEqual([99, 0])
    // ...and stimulus-0 (untouched) survived the wholesale rebuild.
    expect(Array.from(getEventBuffer(engine, 0, 0, 0)!)).toEqual([10, 0, 20, 0])
    expect(engine.eventsPerStimulus).toEqual([true, true])
    expect(engine.capabilities.event).toBe(true)
  })

  test('removing all occurrences clears the event capability', () => {
    const engine = new DataEngine()
    engine.loadDataset(datasetWithEvents())
    engine.updateEventDataBatch([
      { stimulusId: 0, channelDefs: [], eventBuffers: [] },
    ])
    expect(engine.capabilities.event).toBe(false)
    expect(engine.eventsPerStimulus).toEqual([false, false])
  })
})
