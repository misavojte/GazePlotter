/**
 * Vitest tests for CsvSegmentedFromToEyeDeserializer
 *
 * @module CsvSegmentedFromToEyeDeserializer
 * @see src/lib/class/Eye/EyeDeserializer/CsvSegmentedFromToEyeDeserializer.ts
 */

import { CsvSegmentedFromToEyeDeserializer } from '$lib/gaze-data/back-process/class/EyeDeserializer/CsvSegmentedFromToEyeDeserializer'
import type { SingleDeserializerOutput } from '$lib/gaze-data/back-process/types/SingleDeserializerOutput'
import { test, expect, describe } from 'vitest'

const csvMockDataOne = `From,To,Participant,Stimulus,AOI
0,1,Participant_1,Map_A,Region_1
1,2,Participant_1,Map_A,Region_1
0,5,Participant_2,Map_B,Region_1
5,6,Participant_2,Map_A,Region_1`

describe('CSV Segmented FromTo Deserializer - Single data', () => {
  const csvRows = csvMockDataOne.split('\n')
  const header = csvRows[0].split(',')
  test('Constructor', () => {
    const sut = new CsvSegmentedFromToEyeDeserializer(header)
    expect(sut).toBeDefined()
    expect(sut.cAoi).toBe(4)
    expect(sut.cParticipant).toBe(2)
    expect(sut.cStimulus).toBe(3)
    expect(sut.cFrom).toBe(0)
    expect(sut.cTo).toBe(1)
  })

  test('Process first row', () => {
    const sut = new CsvSegmentedFromToEyeDeserializer(header)
    const row = csvRows[1].split(',')
    const result = sut.deserialize(row) as SingleDeserializerOutput
    expect(result).toBeDefined()
    expect(result.aoi).toEqual(['Region_1'])
    expect(result.category).toEqual('Fixation')
    expect(result.end).toEqual('1')
    expect(result.participant).toEqual('Participant_1')
    expect(result.stimulus).toEqual('Map_A')
    expect(result.start).toEqual('0')
  })

  test('Process second row', () => {
    const sut = new CsvSegmentedFromToEyeDeserializer(header)
    const row = csvRows[2].split(',')
    const result = sut.deserialize(row) as SingleDeserializerOutput
    expect(result).toBeDefined()
    expect(result.aoi).toEqual(['Region_1'])
    expect(result.category).toEqual('Fixation')
    expect(result.end).toEqual('2')
    expect(result.participant).toEqual('Participant_1')
    expect(result.stimulus).toEqual('Map_A')
    expect(result.start).toEqual('1')
  })

  test('Process third row', () => {
    const sut = new CsvSegmentedFromToEyeDeserializer(header)
    const row = csvRows[3].split(',')
    const result = sut.deserialize(row) as SingleDeserializerOutput
    expect(result).toBeDefined()
    expect(result.aoi).toEqual(['Region_1'])
    expect(result.category).toEqual('Fixation')
    expect(result.end).toEqual('5')
    expect(result.participant).toEqual('Participant_2')
    expect(result.stimulus).toEqual('Map_B')
    expect(result.start).toEqual('0')
  })

  test('Process fourth row', () => {
    const sut = new CsvSegmentedFromToEyeDeserializer(header)
    const row = csvRows[4].split(',')
    const result = sut.deserialize(row) as SingleDeserializerOutput
    expect(result).toBeDefined()
    expect(result.aoi).toEqual(['Region_1'])
    expect(result.category).toEqual('Fixation')
    expect(result.end).toEqual('6')
    expect(result.participant).toEqual('Participant_2')
    expect(result.stimulus).toEqual('Map_A')
    expect(result.start).toEqual('5')
  })

  test('Finalize', () => {
    const sut = new CsvSegmentedFromToEyeDeserializer(header)
    const row = csvRows[4].split(',')
    void sut.deserialize(row)
    const result = sut.finalize()
    expect(result).toBeNull()
  })
})
