/**
 * Vitest tests for CsvSegmentedFromToAdapter
 *
 * @module CsvSegmentedFromToAdapter
 * @see src/lib/data/ingest/stream/adapters/CsvSegmentedFromToAdapter.ts
 */

import { CsvSegmentedFromToAdapter } from '$lib/data/ingest/stream/adapters/CsvSegmentedFromToAdapter'
import { test, expect, describe } from 'vitest'
import { createAdapterHarness } from './helpers/ingestAdapterHarness'

const csvMockDataOne = `From,To,Participant,Stimulus,AOI
0,1,Participant_1,Map_A,Region_1
1,2,Participant_1,Map_A,Region_1
0,5,Participant_2,Map_B,Region_1
5,6,Participant_2,Map_A,Region_1
6,7,Participant_2,Map_A,Region_1|Region_2`

describe('CSV Segmented FromTo Deserializer - Single data', () => {
  const csvRows = csvMockDataOne.split('\n')
  const header = csvRows[0].split(',')
  const delim = ','
  test('Constructor', () => {
    const sut = new CsvSegmentedFromToAdapter(header, delim)
    expect(sut).toBeDefined()
    expect(sut.cAoi).toBe(4)
    expect(sut.cParticipant).toBe(2)
    expect(sut.cStimulus).toBe(3)
    expect(sut.cFrom).toBe(0)
    expect(sut.cTo).toBe(1)
  })

  test('Process first row', () => {
    const sut = new CsvSegmentedFromToAdapter(header, delim)
    const { outputs, processRow } = createAdapterHarness(sut)
    processRow(csvRows[1])
    const result = outputs[0]
    expect(result).toBeDefined()
    expect(result.aoi).toEqual(['Region_1'])
    expect(result.categoryId).toEqual(0)
    expect(result.end).toEqual(1)
    expect(result.participant).toEqual('Participant_1')
    expect(result.stimulus).toEqual('Map_A')
    expect(result.start).toEqual(0)
  })

  test('Process second row', () => {
    const sut = new CsvSegmentedFromToAdapter(header, delim)
    const { outputs, processRow } = createAdapterHarness(sut)
    processRow(csvRows[2])
    const result = outputs[0]
    expect(result).toBeDefined()
    expect(result.aoi).toEqual(['Region_1'])
    expect(result.categoryId).toEqual(0)
    expect(result.end).toEqual(2)
    expect(result.participant).toEqual('Participant_1')
    expect(result.stimulus).toEqual('Map_A')
    expect(result.start).toEqual(1)
  })

  test('Process third row', () => {
    const sut = new CsvSegmentedFromToAdapter(header, delim)
    const { outputs, processRow } = createAdapterHarness(sut)
    processRow(csvRows[3])
    const result = outputs[0]
    expect(result).toBeDefined()
    expect(result.aoi).toEqual(['Region_1'])
    expect(result.categoryId).toEqual(0)
    expect(result.end).toEqual(5)
    expect(result.participant).toEqual('Participant_2')
    expect(result.stimulus).toEqual('Map_B')
    expect(result.start).toEqual(0)
  })

  test('Process fourth row', () => {
    const sut = new CsvSegmentedFromToAdapter(header, delim)
    const { outputs, processRow } = createAdapterHarness(sut)
    processRow(csvRows[4])
    const result = outputs[0]
    expect(result).toBeDefined()
    expect(result.aoi).toEqual(['Region_1'])
    expect(result.categoryId).toEqual(0)
    expect(result.end).toEqual(6)
    expect(result.participant).toEqual('Participant_2')
    expect(result.stimulus).toEqual('Map_A')
    expect(result.start).toEqual(5)
  })

  test('Process fifth row (multiple AOIs)', () => {
    const sut = new CsvSegmentedFromToAdapter(header, delim)
    const { outputs, processRow } = createAdapterHarness(sut)
    processRow(csvRows[5])
    const result = outputs[0]
    expect(result).toBeDefined()
    expect(result.aoi).toEqual(['Region_1', 'Region_2'])
    expect(result.categoryId).toEqual(0)
    expect(result.end).toEqual(7)
    expect(result.participant).toEqual('Participant_2')
    expect(result.stimulus).toEqual('Map_A')
    expect(result.start).toEqual(6)
  })

  test('Finalize', () => {
    const sut = new CsvSegmentedFromToAdapter(header, delim)
    const { processRow, finalize } = createAdapterHarness(sut)
    processRow(csvRows[4])
    const result = finalize()
    expect(result).toBeUndefined()
  })
})

describe('CSV Segmented FromTo Deserializer - Spatial coordinates', () => {
  test('parses optional X/Y columns', () => {
    const raw = `From,To,Participant,Stimulus,AOI,X,Y
0,10,P1,S1,A1,640,360
10,20,P1,S1,A2,,`

    const rows = raw.split('\n')
    const header = rows[0].split(',')
    const sut = new CsvSegmentedFromToAdapter(header, ',')
    const { outputs, processRows } = createAdapterHarness(sut)
    processRows(rows.slice(1), { finalize: true })

    expect(outputs).toHaveLength(2)
    expect(outputs[0].spatial).toEqual({ x: 640, y: 360 })
    expect(outputs[1].spatial).toBeNull()
  })
})
