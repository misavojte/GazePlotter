/**
 * Vitest tests for VarjoEyeDeserializer
 *
 * @module VarjoEyeDeserializer
 * @see src/lib/class/Eye/EyeDeserializer/VarjoEyeDeserializer.ts
 */

import { VarjoEyeDeserializer } from '$lib/class/Eye/EyeDeserializer/VarjoEyeDeserializer.ts'
import { test, expect, describe } from 'vitest'
import type { SingleDeserializerOutput } from '$lib/type/DeserializerOutput/SingleDeserializerOutput/SingleDeserializerOutput.ts'

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

describe('VarjoEyeDeserializer', () => {
  const varjoRows = varjoMockData.split('\n')
  const header = varjoRows[0].split(',')
  test('Constructor', () => {
    const sut = new VarjoEyeDeserializer(header, 'VarjoXXX.csv')
    expect(sut).toBeDefined()
    expect(sut.cTime).toBe(0)
    expect(sut.cActorLabel).toBe(1)
    expect(sut.mParticipant).toBe('VarjoXXX')
  })

  const sut = new VarjoEyeDeserializer(header, 'VarjoXXX.csv')

  test('Process first row', () => {
    const row = varjoRows[1].split(',')
    const result = sut.deserialize(row) as SingleDeserializerOutput
    expect(result).toBeNull()
  })

  test('Process second row', () => {
    const row = varjoRows[2].split(',')
    const result = sut.deserialize(row) as SingleDeserializerOutput
    expect(result).toBeNull()
  })

  test('Process third row', () => {
    const row = varjoRows[3].split(',')
    const result = sut.deserialize(row) as SingleDeserializerOutput
    expect(result).toBeNull()
  })

  test('Process fourth row', () => {
    const row = varjoRows[4].split(',')
    const result = sut.deserialize(row) as SingleDeserializerOutput
    console.log(result)
    expect(result).toBeDefined()
    expect(result.aoi).toEqual(['Region_1'])
    expect(result.category).toEqual('Fixation')
    expect(result.end).toEqual('2')
    expect(result.participant).toEqual('VarjoXXX')
    expect(result.stimulus).toEqual('VarjoScene')
    expect(result.start).toEqual('0')
  })

  test('Process fifth row', () => {
    const row = varjoRows[5].split(',')
    const result = sut.deserialize(row) as SingleDeserializerOutput
    console.log(result)
    expect(result).toBeDefined()
    expect(result.aoi).toEqual(['Region_2'])
    expect(result.category).toEqual('Fixation')
    expect(result.end).toEqual('3')
    expect(result.participant).toEqual('VarjoXXX')
    expect(result.stimulus).toEqual('VarjoScene')
    expect(result.start).toEqual('3')
  })

  test('Process sixth row', () => {
    const row = varjoRows[6].split(',')
    const result = sut.deserialize(row) as SingleDeserializerOutput
    console.log(result)
    expect(result).toBeDefined()
    expect(result.aoi).toEqual(['Region_3'])
    expect(result.category).toEqual('Fixation')
    expect(result.end).toEqual('4')
    expect(result.participant).toEqual('VarjoXXX')
    expect(result.stimulus).toEqual('VarjoScene')
    expect(result.start).toEqual('4')
  })

  test('Finalize', () => {
    const result = sut.finalize() as SingleDeserializerOutput
    expect(result).toBeDefined()
    expect(result.aoi).toEqual(['Region_4'])
    expect(result.category).toEqual('Fixation')
    expect(result.end).toEqual('5')
    expect(result.participant).toEqual('VarjoXXX')
    expect(result.stimulus).toEqual('VarjoScene')
    expect(result.start).toEqual('5')
  })
})
