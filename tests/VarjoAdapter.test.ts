/**
 * Vitest tests for VarjoAdapter
 *
 * @module VarjoAdapter
 * @see $lib/data/ingest/stream/adapters/VarjoAdapter.ts
 */

import { VarjoAdapter } from '$lib/data/ingest/stream/adapters/VarjoAdapter'
import { test, expect, describe } from 'vitest'
import { createAdapterHarness } from './helpers/ingestAdapterHarness'

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

describe('VarjoAdapter', () => {
  const varjoRows = varjoMockData.split('\n')
  const header = varjoRows[0].split(',')
  const delim = ','
  test('Constructor', () => {
    const sut = new VarjoAdapter(header, 'VarjoXXX.csv', delim)
    expect(sut).toBeDefined()
    expect(sut.cTime).toBe(0)
    expect(sut.cActorLabel).toBe(1)
    expect(sut.mParticipant).toBe('VarjoXXX')
  })

  test('Process first row', () => {
    const sut = new VarjoAdapter(header, 'VarjoXXX.csv', delim)
    const { outputs, processRow } = createAdapterHarness(sut)
    processRow(varjoRows[1])
    expect(outputs).toHaveLength(0)
  })

  test('Process second row', () => {
    const sut = new VarjoAdapter(header, 'VarjoXXX.csv', delim)
    const { outputs, processRow } = createAdapterHarness(sut)
    processRow(varjoRows[1])
    processRow(varjoRows[2])
    expect(outputs).toHaveLength(0)
  })

  test('Process third row', () => {
    const sut = new VarjoAdapter(header, 'VarjoXXX.csv', delim)
    const { outputs, processRow } = createAdapterHarness(sut)
    processRow(varjoRows[1])
    processRow(varjoRows[2])
    processRow(varjoRows[3])
    expect(outputs).toHaveLength(0)
  })

  test('Process fourth row', () => {
    const sut = new VarjoAdapter(header, 'VarjoXXX.csv', delim)
    const { outputs, processRow } = createAdapterHarness(sut)
    processRow(varjoRows[1])
    processRow(varjoRows[2])
    processRow(varjoRows[3])
    processRow(varjoRows[4])
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
    const sut = new VarjoAdapter(header, 'VarjoXXX.csv', delim)
    const { outputs, processRow } = createAdapterHarness(sut)
    processRow(varjoRows[1])
    processRow(varjoRows[2])
    processRow(varjoRows[3])
    processRow(varjoRows[4])
    processRow(varjoRows[5])
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
    const sut = new VarjoAdapter(header, 'VarjoXXX.csv', delim)
    const { outputs, processRow } = createAdapterHarness(sut)
    processRow(varjoRows[1])
    processRow(varjoRows[2])
    processRow(varjoRows[3])
    processRow(varjoRows[4])
    processRow(varjoRows[5])
    processRow(varjoRows[6])
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
    const sut = new VarjoAdapter(header, 'VarjoXXX.csv', delim)
    const { outputs, processRow, finalize } = createAdapterHarness(sut)
    processRow(varjoRows[1])
    processRow(varjoRows[2])
    processRow(varjoRows[3])
    processRow(varjoRows[4])
    processRow(varjoRows[5])
    processRow(varjoRows[6])
    finalize()
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
