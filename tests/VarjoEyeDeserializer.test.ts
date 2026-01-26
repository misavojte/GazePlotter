/**
 * Vitest tests for VarjoEyeDeserializer
 *
 * @module VarjoEyeDeserializer
 * @see $lib/data/ingest/stream/adapters/VarjoEyeDeserializer.ts
 */

import { VarjoEyeDeserializer } from '$lib/data/ingest/stream/adapters/VarjoEyeDeserializer'
import { test, expect, describe } from 'vitest'
import { decodeBytes, encodeString } from '$lib/data/ingest/utils/byteUtils'

/*
  constructor (header: string[], fileName: string) {
    super()
    this.cTime = this.getIndex(header, 'Time')
    this.cActorLabel = this.getIndex(header, 'Actor Label')
    this.mParticipant = fileName.split('.')[0]
  }
  */
const varjoMockData = `Time,Actor Label
2022:11:11:15:50:18:30,Region_1
2022:11:11:15:50:18:31,Region_1
2022:11:11:15:50:18:32,Region_1
2022:11:11:15:50:18:33,Region_2
2022:11:11:15:50:18:34,Region_3
2022:11:11:15:50:18:35,Region_4`

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

const collectOutputs = (sut: VarjoEyeDeserializer) => {
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

const processRow = (sut: VarjoEyeDeserializer, row: string) => {
  sut.processRowBytes(encodeRow(row), decoder)
}

describe('VarjoEyeDeserializer', () => {
  const varjoRows = varjoMockData.split('\n')
  const header = varjoRows[0].split(',')
  const delim = ','
  test('Constructor', () => {
    const sut = new VarjoEyeDeserializer(header, 'VarjoXXX.csv', delim)
    expect(sut).toBeDefined()
    expect(sut.cTime).toBe(0)
    expect(sut.cActorLabel).toBe(1)
    expect(sut.mParticipant).toBe('VarjoXXX')
  })

  test('Process first row', () => {
    const sut = new VarjoEyeDeserializer(header, 'VarjoXXX.csv', delim)
    const outputs = collectOutputs(sut)
    processRow(sut, varjoRows[1])
    expect(outputs).toHaveLength(0)
  })

  test('Process second row', () => {
    const sut = new VarjoEyeDeserializer(header, 'VarjoXXX.csv', delim)
    const outputs = collectOutputs(sut)
    processRow(sut, varjoRows[1])
    processRow(sut, varjoRows[2])
    expect(outputs).toHaveLength(0)
  })

  test('Process third row', () => {
    const sut = new VarjoEyeDeserializer(header, 'VarjoXXX.csv', delim)
    const outputs = collectOutputs(sut)
    processRow(sut, varjoRows[1])
    processRow(sut, varjoRows[2])
    processRow(sut, varjoRows[3])
    expect(outputs).toHaveLength(0)
  })

  test('Process fourth row', () => {
    const sut = new VarjoEyeDeserializer(header, 'VarjoXXX.csv', delim)
    const outputs = collectOutputs(sut)
    processRow(sut, varjoRows[1])
    processRow(sut, varjoRows[2])
    processRow(sut, varjoRows[3])
    processRow(sut, varjoRows[4])
    const result = outputs[0]
    expect(result).toBeDefined()
    expect(result.aoi).toEqual(['Region_1'])
    expect(result.categoryId).toEqual(0)
    expect(result.end).toEqual(2)
    expect(result.participant).toEqual('VarjoXXX')
    expect(result.stimulus).toEqual('VarjoScene')
    expect(result.start).toEqual(0)
  })

  test('Process fifth row', () => {
    const sut = new VarjoEyeDeserializer(header, 'VarjoXXX.csv', delim)
    const outputs = collectOutputs(sut)
    processRow(sut, varjoRows[1])
    processRow(sut, varjoRows[2])
    processRow(sut, varjoRows[3])
    processRow(sut, varjoRows[4])
    processRow(sut, varjoRows[5])
    const result = outputs[1]
    expect(result).toBeDefined()
    expect(result.aoi).toEqual(['Region_2'])
    expect(result.categoryId).toEqual(0)
    expect(result.end).toEqual(3)
    expect(result.participant).toEqual('VarjoXXX')
    expect(result.stimulus).toEqual('VarjoScene')
    expect(result.start).toEqual(3)
  })

  test('Process sixth row', () => {
    const sut = new VarjoEyeDeserializer(header, 'VarjoXXX.csv', delim)
    const outputs = collectOutputs(sut)
    processRow(sut, varjoRows[1])
    processRow(sut, varjoRows[2])
    processRow(sut, varjoRows[3])
    processRow(sut, varjoRows[4])
    processRow(sut, varjoRows[5])
    processRow(sut, varjoRows[6])
    const result = outputs[2]
    expect(result).toBeDefined()
    expect(result.aoi).toEqual(['Region_3'])
    expect(result.categoryId).toEqual(0)
    expect(result.end).toEqual(4)
    expect(result.participant).toEqual('VarjoXXX')
    expect(result.stimulus).toEqual('VarjoScene')
    expect(result.start).toEqual(4)
  })

  test('Finalize', () => {
    const sut = new VarjoEyeDeserializer(header, 'VarjoXXX.csv', delim)
    const outputs = collectOutputs(sut)
    processRow(sut, varjoRows[1])
    processRow(sut, varjoRows[2])
    processRow(sut, varjoRows[3])
    processRow(sut, varjoRows[4])
    processRow(sut, varjoRows[5])
    processRow(sut, varjoRows[6])
    sut.finalize()
    const result = outputs[3]
    expect(result).toBeDefined()
    expect(result.aoi).toEqual(['Region_4'])
    expect(result.categoryId).toEqual(0)
    expect(result.end).toEqual(5)
    expect(result.participant).toEqual('VarjoXXX')
    expect(result.stimulus).toEqual('VarjoScene')
    expect(result.start).toEqual(5)
  })
})
