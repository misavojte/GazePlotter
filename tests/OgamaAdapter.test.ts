/**
 * Vitest tests for OgamaAdapter
 *
 * Note that OGAMA data does not have time information, so the start and end of each segment
 * are just the index of the letter in the string.
 *
 * @module OgamaAdapter
 * @see $lib/data/ingest/stream/adapters/OgamaAdapter.ts
 */

import { OgamaAdapter } from '$lib/data/ingest/stream/adapters/OgamaAdapter'
import { decodeBytes, encodeString } from '$lib/data/ingest/utils/byteUtils'
import { test, expect, describe } from 'vitest'

const ogamaMockDataOne = `Sequence Similarity,Scanpath string
Participant_1,ABCD
Participant_2,DBCA`

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

const collectOutputs = (sut: OgamaAdapter) => {
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

const processRow = (sut: OgamaAdapter, row: string) => {
  sut.processRowBytes(encodeRow(row), decoder)
}

describe('OGAMA Deserializer - Single data', () => {
  const ogamaRows = ogamaMockDataOne.split('\n')
  const header = ogamaRows[0].split(',')
  const delim = ','
  test('Constructor', () => {
    const sut = new OgamaAdapter(header, 'SimilarityXXX.txt', delim)
    expect(sut).toBeDefined()
    expect(sut.cParticipant).toBe(0)
    expect(sut.cSegments).toBe(1)
  })

  test('Process first row - Segment 1', () => {
    const sut = new OgamaAdapter(header, 'SimilarityXXX.txt', delim)
    const outputs = collectOutputs(sut)
    processRow(sut, ogamaRows[1])
    expect(outputs).toBeDefined()
    expect(outputs.length).toBe(4)
    expect(outputs[0].aoi).toEqual(['A'])
    expect(outputs[0].categoryId).toEqual(0)
    expect(outputs[0].end).toEqual(1)
    expect(outputs[0].participant).toEqual('Participant_1')
    expect(outputs[0].stimulus).toEqual('SimilarityXXX')
    expect(outputs[0].start).toEqual(0)
  })

  test('Process first row - Segment 2', () => {
    const sut = new OgamaAdapter(header, 'SimilarityXXX.txt', delim)
    const outputs = collectOutputs(sut)
    processRow(sut, ogamaRows[1])
    expect(outputs).toBeDefined()
    expect(outputs.length).toBe(4)
    expect(outputs[1].aoi).toEqual(['B'])
    expect(outputs[1].categoryId).toEqual(0)
    expect(outputs[1].end).toEqual(2)
    expect(outputs[1].participant).toEqual('Participant_1')
    expect(outputs[1].stimulus).toEqual('SimilarityXXX')
    expect(outputs[1].start).toEqual(1)
  })

  test('Process second row - Segment 1', () => {
    const sut = new OgamaAdapter(header, 'SimilarityXXX.txt', delim)
    const outputs = collectOutputs(sut)
    processRow(sut, ogamaRows[2])
    expect(outputs).toBeDefined()
    expect(outputs.length).toBe(4)
    expect(outputs[0].aoi).toEqual(['D'])
    expect(outputs[0].categoryId).toEqual(0)
    expect(outputs[0].end).toEqual(1)
    expect(outputs[0].participant).toEqual('Participant_2')
    expect(outputs[0].stimulus).toEqual('SimilarityXXX')
    expect(outputs[0].start).toEqual(0)
  })

  test('Process second row - Segment 2', () => {
    const sut = new OgamaAdapter(header, 'SimilarityXXX.txt', delim)
    const outputs = collectOutputs(sut)
    processRow(sut, ogamaRows[2])
    expect(outputs).toBeDefined()
    expect(outputs.length).toBe(4)
    expect(outputs[1].aoi).toEqual(['B'])
    expect(outputs[1].categoryId).toEqual(0)
    expect(outputs[1].end).toEqual(2)
    expect(outputs[1].participant).toEqual('Participant_2')
    expect(outputs[1].stimulus).toEqual('SimilarityXXX')
    expect(outputs[1].start).toEqual(1)
  })
})
