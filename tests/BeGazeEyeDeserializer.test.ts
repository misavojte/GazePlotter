/**
 * Vitest tests for BeGazeEyeDeserializer
 *
 * @module BeGazeEyeDeserializer
 * @see $lib/data/ingest/stream/adapters/BeGazeEyeDeserializer.ts
 */

import { BeGazeEyeDeserializer } from '$lib/data/ingest/stream/adapters/BeGazeEyeDeserializer'
import { decodeBytes, encodeString } from '$lib/data/ingest/utils/byteUtils'
import { test, expect, describe } from 'vitest'

const begazeMockData = `Event Start Trial Time [ms],Event End Trial Time [ms],Stimulus,Participant,Category,AOI Name
0,100,Map_A,Participant_1,Fixation,Region_1
100,200,Map_A,Participant_1,Fixation,Region_1
200,300,Map_A,Participant_1,Fixation,Region_1
300,400,Map_A,Participant_1,Fixation,Region_2
400,500,Map_A,Participant_1,Fixation,Region_3`

type EmittedSegment = {
  start: number
  end: number
  categoryId: number
  stimulus: string
  participant: string
  aoi: string[] | null
}

const decoder = new TextDecoder('utf-8')
const encodeRow = (row: string) => encodeString(row, 'utf-8')

const collectOutputs = (sut: BeGazeEyeDeserializer) => {
  const outputs: EmittedSegment[] = []
  sut.onSegment = (start, end, categoryId, stimulus, participant, aoi) => {
    outputs.push({
      start,
      end,
      categoryId,
      stimulus: decodeBytes(stimulus, decoder),
      participant: decodeBytes(participant, decoder),
      aoi: aoi ? aoi.map(a => decodeBytes(a, decoder)) : null,
    })
  }
  return outputs
}

const processRow = (sut: BeGazeEyeDeserializer, row: string) => {
  sut.processRowBytes(encodeRow(row), decoder)
}

describe('BeGaze Deserializer - Single data', () => {
  const begazeRows = begazeMockData.split('\n')
  const header = begazeRows[0].split(',')
  const delim = ','
  test('Constructor', () => {
    const sut = new BeGazeEyeDeserializer(header, delim)
    expect(sut).toBeDefined()
    expect(sut.cStart).toBe(0)
    expect(sut.cEnd).toBe(1)
    expect(sut.cStimulus).toBe(2)
    expect(sut.cParticipant).toBe(3)
    expect(sut.cCategory).toBe(4)
    expect(sut.cAoi).toBe(5)
  })

  test('Process first row', () => {
    const sut = new BeGazeEyeDeserializer(header, delim)
    const outputs = collectOutputs(sut)
    processRow(sut, begazeRows[1])
    const result = outputs[0]
    expect(result).toEqual({
      aoi: ['Region_1'],
      categoryId: 0,
      end: 100,
      participant: 'Participant_1',
      start: 0,
      stimulus: 'Map_A',
    })
  })

  test('Process last row', () => {
    const sut = new BeGazeEyeDeserializer(header, delim)
    const outputs = collectOutputs(sut)
    processRow(sut, begazeRows[5])
    const result = outputs[0]
    expect(result).toEqual({
      aoi: ['Region_3'],
      categoryId: 0,
      end: 500,
      participant: 'Participant_1',
      start: 400,
      stimulus: 'Map_A',
    })
  })

  test('Process row with invalid category', () => {
    const sut = new BeGazeEyeDeserializer(header, delim)
    const outputs = collectOutputs(sut)
    processRow(sut, '0,100,Map_A,Participant_1,Separator,Region_1')
    expect(outputs).toHaveLength(0)
  })

  test('Process row with invalid start or end', () => {
    const sut = new BeGazeEyeDeserializer(header, delim)
    const outputs = collectOutputs(sut)
    processRow(sut, 'a,100,Map_A,Participant_1,Fixation,Region_1')
    expect(outputs).toHaveLength(0)
  })
})
