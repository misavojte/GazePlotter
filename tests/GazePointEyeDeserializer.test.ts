/**
 * Vitest tests for GazePointEyeDeserializer
 *
 * @module GazePointEyeDeserializer
 * @see $lib/data/ingest/stream/adapters/GazePointEyeDeserializer.ts
 */

import { test, expect, describe } from 'vitest'
import { GazePointEyeDeserializer } from '$lib/data/ingest/stream/adapters/GazePointEyeDeserializer'
import { decodeBytes, encodeString } from '$lib/data/ingest/utils/byteUtils'

const separator = ','
const header =
  'MEDIA_ID,MEDIA_NAME,TIME(2021/07/13 09:21:09.801),FPOGS,FPOGD,FPOGID,BKID,BKDUR,AOI,'.split(
    separator
  )

const fixRow1 = '0,Slide0,0.06689,0.00000,0.06689,1,0,0.00000,,'
const fixRow2 = '0,Slide0,0.13378,0.06689,0.06689,2,0,0.00000,,'

const rawRow1 = '2,Slide01,1.52063,1.38635,0.13428,6,0,0.00000,Right-AOI 4,'
const rawRow2 = '2,Slide01,1.54968,1.38635,0.16333,6,0,0.00000,Right-AOI 4,'
const rawRow3 = '2,Slide01,1.57410,1.38635,0.16333,6,157,0.00000,,'
const rawRow4 = '2,Slide01,1.71008,1.38635,0.16333,6,0,0.13605,,' // with blink dur info
const rawRow5 = '2,Slide01,1.74805,1.72827,0.01978,7,0,0.00000,Right-AOI 4,'
const rawRow6 = '2,Slide01,1.91528,1.72827,0.18701,7,0,0.00000,Right-AOI 4,'
const rawRow7 = '2,Slide01,1.92200,1.72827,0.18701,7,0,0.00000,,'
const rawRow8 = '2,Slide01,1.93200,1.72827,0.18701,7,0,0.00000,,'
const rawRow9 = '2,Slide01,1.94200,1.93200,0.10000,8,0,0.00000,,'

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

const collectOutputs = (sut: GazePointEyeDeserializer) => {
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

const processRow = (sut: GazePointEyeDeserializer, row: string) => {
  sut.processRowBytes(encodeRow(row), decoder)
}

describe('GazePoint Reducer', () => {
  test('Construct Reducer', () => {
    const reducer = new GazePointEyeDeserializer(header, 'P1', separator)
    expect(reducer).toBeInstanceOf(GazePointEyeDeserializer)
  })
  test('Reduce Fixation', () => {
    const reducer = new GazePointEyeDeserializer(header, 'P1', separator)
    const outputs = collectOutputs(reducer)
    processRow(reducer, fixRow1)
    expect(outputs).toHaveLength(0)
    processRow(reducer, fixRow2)
    const result2 = outputs[0]
    expect(result2.aoi).toBeNull()
    expect(result2.categoryId).toBe(0)
    expect(result2.end).toBeCloseTo(0.06689, 5)
    expect(result2.participant).toBe('P1')
    expect(result2.start).toBeCloseTo(0, 5)
    expect(result2.stimulus).toBe('Slide0')
    reducer.finalize()
    const result3 = outputs[1]
    expect(result3.aoi).toBeNull()
    expect(result3.categoryId).toBe(0)
    expect(result3.end).toBeCloseTo(0.13378, 5)
    expect(result3.participant).toBe('P1')
    expect(result3.start).toBeCloseTo(0.06689, 5)
    expect(result3.stimulus).toBe('Slide0')
  })
  test('Reduce Raw', () => {
    const reducer = new GazePointEyeDeserializer(header, 'P1', separator)
    const outputs = collectOutputs(reducer)
    processRow(reducer, rawRow1)
    processRow(reducer, rawRow2)
    processRow(reducer, rawRow3)
    const result1 = outputs[0]
    expect(result1.aoi?.[0]).toBe('Right-AOI 4')
    expect(result1.categoryId).toBe(0)
    expect(result1.end).toBeCloseTo(1.54968, 5)
    expect(result1.participant).toBe('P1')
    expect(result1.start).toBeCloseTo(1.38635, 5)
    processRow(reducer, rawRow4)
    processRow(reducer, rawRow5)
    const blinkResult = outputs[1]
    expect(blinkResult.aoi).toBeNull()
    expect(blinkResult.start).toBeCloseTo(1.5741, 5)
    expect(blinkResult.categoryId).toBe(1)
    expect(blinkResult.end).toBeCloseTo(1.71008, 5)
    processRow(reducer, rawRow6)
    processRow(reducer, rawRow7)
    const result2 = outputs[2]
    expect(result2.aoi?.[0]).toBe('Right-AOI 4')
    expect(result2.categoryId).toBe(0)
    expect(result2.end).toBeCloseTo(1.91528, 5)
    processRow(reducer, rawRow8)
    processRow(reducer, rawRow9)
  })
})
