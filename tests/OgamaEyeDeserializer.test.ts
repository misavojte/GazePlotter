/**
 * Vitest tests for OgamaEyeDeserializer
 *
 * Note that OGAMA data does not have time information, so the start and end of each segment
 * are just the index of the letter in the string.
 *
 * @module OgamaEyeDeserializer
 * @see src/lib/class/Eye/EyeDeserializer/OgamaEyeDeserializer.ts
 */

import { OgamaEyeDeserializer } from '$lib/class/Eye/EyeDeserializer/OgamaEyeDeserializer.ts'
import type { SingleDeserializerOutput } from '$lib/type/DeserializerOutput/SingleDeserializerOutput/SingleDeserializerOutput.js'
import { test, expect, describe } from 'vitest'

const ogamaMockDataOne = `Sequence Similarity,Scanpath string
Participant_1,ABCD
Participant_2,DBCA`

describe('OGAMA Deserializer - Single data', () => {
  const ogamaRows = ogamaMockDataOne.split('\n')
  const header = ogamaRows[0].split(',')
  test('Constructor', () => {
    const sut = new OgamaEyeDeserializer(header, 'SimilarityXXX.txt')
    expect(sut).toBeDefined()
    expect(sut.cParticipant).toBe(0)
    expect(sut.cSegments).toBe(1)
  })

  test('Process first row - Segment 1', () => {
    const sut = new OgamaEyeDeserializer(header, 'SimilarityXXX.txt')
    const row = ogamaRows[1].split(',')
    const result = sut.deserialize(row) as SingleDeserializerOutput[]
    expect(result).toBeDefined()
    expect(result.length).toBe(4)
    expect(result[0].aoi).toEqual(['A'])
    expect(result[0].category).toEqual('Fixation')
    expect(result[0].end).toEqual('1')
    expect(result[0].participant).toEqual('Participant_1')
    expect(result[0].stimulus).toEqual('SimilarityXXX')
    expect(result[0].start).toEqual('0')
  })

  test('Process first row - Segment 2', () => {
    const sut = new OgamaEyeDeserializer(header, 'SimilarityXXX.txt')
    const row = ogamaRows[1].split(',')
    const result = sut.deserialize(row) as SingleDeserializerOutput[]
    expect(result).toBeDefined()
    expect(result.length).toBe(4)
    expect(result[1].aoi).toEqual(['B'])
    expect(result[1].category).toEqual('Fixation')
    expect(result[1].end).toEqual('2')
    expect(result[1].participant).toEqual('Participant_1')
    expect(result[1].stimulus).toEqual('SimilarityXXX')
    expect(result[1].start).toEqual('1')
  })

  test('Process second row - Segment 1', () => {
    const sut = new OgamaEyeDeserializer(header, 'SimilarityXXX.txt')
    const row = ogamaRows[2].split(',')
    const result = sut.deserialize(row) as SingleDeserializerOutput[]
    expect(result).toBeDefined()
    expect(result.length).toBe(4)
    expect(result[0].aoi).toEqual(['D'])
    expect(result[0].category).toEqual('Fixation')
    expect(result[0].end).toEqual('1')
    expect(result[0].participant).toEqual('Participant_2')
    expect(result[0].stimulus).toEqual('SimilarityXXX')
    expect(result[0].start).toEqual('0')
  })

  test('Process second row - Segment 2', () => {
    const sut = new OgamaEyeDeserializer(header, 'SimilarityXXX.txt')
    const row = ogamaRows[2].split(',')
    const result = sut.deserialize(row) as SingleDeserializerOutput[]
    expect(result).toBeDefined()
    expect(result.length).toBe(4)
    expect(result[1].aoi).toEqual(['B'])
    expect(result[1].category).toEqual('Fixation')
    expect(result[1].end).toEqual('2')
    expect(result[1].participant).toEqual('Participant_2')
    expect(result[1].stimulus).toEqual('SimilarityXXX')
    expect(result[1].start).toEqual('1')
  })
})
