/**
 * Vitest tests for CsvAdapter
 *
 * @module CsvAdapter
 * @see $lib/data/ingest/stream/adapters/CsvAdapter.ts
 */

import { CsvAdapter } from '$lib/data/ingest/stream/adapters/CsvAdapter'
import { test, expect, describe } from 'vitest'
import { createAdapterHarness } from './helpers/ingestAdapterHarness'

const csvMockDataOne = `Time,Participant,Stimulus,AOI
0,Participant_1,Map_A,Region_1
1,Participant_1,Map_A,Region_1
2,Participant_1,Map_A,Region_1
3,Participant_1,Map_A,Region_2
4,Participant_1,Map_A,Region_3
5,Participant_1,Map_A,Region_4
0,Participant_2,Map_B,Region_1
1,Participant_2,Map_B,Region_1
2,Participant_2,Map_B,Region_1
3,Participant_2,Map_B,Region_2
4,Participant_2,Map_B,Region_3
5,Participant_2,Map_B,Region_4
0,Participant_3,Map_C,Region_2
1,Participant_3,Map_C,Region_2
2,Participant_3,Map_C,Region_2
3,Participant_3,Map_C,Region_3
4,Participant_3,Map_C,Region_4
5,Participant_3,Map_C,Region_5
0,Participant_4,Map_D,Region_3
1,Participant_4,Map_D,Region_3
2,Participant_4,Map_D,Region_3
3,Participant_4,Map_D,Region_4
4,Participant_4,Map_D,Region_5
5,Participant_4,Map_D,Region_1`

const csvMockDataTwo = `Time,Participant,Stimulus,AOI
9,Participant_1,Map_A,Region_3
10,Participant_1,Map_A,Region_4
11,Participant_1,Map_A,Region_4
12,Participant_2,Map_B,Region_1
13,Participant_2,Map_B,Region_1`

describe('CSV Deserializer - Single data', () => {
  const csvRows = csvMockDataOne.split('\n')
  const header = csvRows[0].split(',')
  const delim = ','
  test('Constructor', () => {
    const sut = new CsvAdapter(header, delim)
    expect(sut).toBeDefined()
    expect(sut.cAoi).toBe(3)
    expect(sut.cParticipant).toBe(1)
    expect(sut.cStimulus).toBe(2)
    expect(sut.cTime).toBe(0)
  })

  test('Process first row', () => {
    const sut = new CsvAdapter(header, delim)
    const { outputs, processRow } = createAdapterHarness(sut)
    processRow(csvRows[1])
    expect(outputs).toHaveLength(0)
    expect(sut.mTimeBase).toEqual(0)
    expect(sut.mTimeStart).toEqual(0)
    expect(sut.mTimeLast).toEqual(0)
  })

  test('Process first segment', () => {
    const sut = new CsvAdapter(header, delim)
    const { outputs, processRow } = createAdapterHarness(sut)
    const row1 = csvRows[1]
    const row2 = csvRows[2]
    const row3 = csvRows[3]
    const row4 = csvRows[4]

    processRow(row1)
    processRow(row2)
    processRow(row3)
    processRow(row4)

    const result = outputs[0]
    expect(result).toEqual({
      aoi: ['Region_1'],
      categoryId: 0,
      start: 0,
      end: 2,
      participant: 'Participant_1',
      stimulus: 'Map_A',
    })
  })

  test('Process second segment', () => {
    const sut = new CsvAdapter(header, delim)
    const { outputs, processRow } = createAdapterHarness(sut)

    const row1 = csvRows[1]
    const row2 = csvRows[2]
    const row3 = csvRows[3]
    const row4 = csvRows[4]
    const row5 = csvRows[5]

    processRow(row1)
    processRow(row2)
    processRow(row3)
    processRow(row4)
    processRow(row5)

    const result = outputs[1]
    expect(result).toEqual({
      aoi: ['Region_2'],
      categoryId: 0,
      start: 3,
      end: 3,
      participant: 'Participant_1',
      stimulus: 'Map_A',
    })

    // BEWARE! If only one timestamp for whole segment, start and end are the same!
  })

  test('Sample 2 - baseTime between segments', () => {
    const sut = new CsvAdapter(header, delim)
    const { outputs, processRow } = createAdapterHarness(sut)
    const csvRows2 = csvMockDataTwo.split('\n')
    const row1 = csvRows2[1]
    const row2 = csvRows2[2]
    const row3 = csvRows2[3]
    const row4 = csvRows2[4]
    processRow(row1)
    processRow(row2)
    processRow(row3)
    processRow(row4)
    const result = outputs[1]
    expect(result).toEqual({
      aoi: ['Region_4'],
      categoryId: 0,
      start: 1,
      end: 2,
      participant: 'Participant_1',
      stimulus: 'Map_A',
    })
  })

  test('Sample 2 - no duplicity segments with 0,0', () => {
    const sut = new CsvAdapter(header, delim)
    const { outputs, processRow } = createAdapterHarness(sut)
    const csvRows2 = csvMockDataTwo.split('\n')
    const row1 = csvRows2[1]
    const row2 = csvRows2[2]
    const row3 = csvRows2[3]
    const row4 = csvRows2[4]
    const row5 = csvRows2[5]
    processRow(row1)
    processRow(row2)
    processRow(row3)
    processRow(row4)
    processRow(row5)
    expect(outputs).toHaveLength(2)
  })
})

describe('CSV Deserializer - Multiple data', async () => {
  test('Mock Data One', async () => {
    const rows = csvMockDataOne.split('\n')
    const header = rows[0].split(',')
    const sut = new CsvAdapter(header, ',')
    const { outputs, processRows } = createAdapterHarness(sut)
    processRows(rows.slice(1), { finalize: true })

    expect(outputs.length).toBe(16) // 16 segments while only 4 with different start and end

    // filter out segments with same start and end
    const filtered = outputs.filter(a => a.start !== a.end)
    expect(filtered.length).toBe(4)

    expect(filtered[0].stimulus).toEqual('Map_A')
    expect(filtered[1].stimulus).toEqual('Map_B')
    expect(filtered[2].stimulus).toEqual('Map_C')
    expect(filtered[3].stimulus).toEqual('Map_D')

    expect(filtered[0].participant).toEqual('Participant_1')
    expect(filtered[1].participant).toEqual('Participant_2')
    expect(filtered[2].participant).toEqual('Participant_3')
    expect(filtered[3].participant).toEqual('Participant_4')

    expect(filtered[0].aoi).toEqual(['Region_1'])
    expect(filtered[1].aoi).toEqual(['Region_1'])
    expect(filtered[2].aoi).toEqual(['Region_2'])
    expect(filtered[3].aoi).toEqual(['Region_3'])
  })
})

describe('CSV Deserializer - Spatial coordinates', () => {
  test('parses optional X/Y columns and emits first valid pair per segment', () => {
    const raw = `Time,Participant,Stimulus,AOI,X,Y
0,P1,S1,A1,100,200
1,P1,S1,A1,150,250
2,P1,S1,A2,300,400`

    const rows = raw.split('\n')
    const header = rows[0].split(',')
    const sut = new CsvAdapter(header, ',')
    const { outputs, processRows } = createAdapterHarness(sut)
    processRows(rows.slice(1), { finalize: true })

    expect(outputs).toHaveLength(2)
    expect(outputs[0].spatial).toEqual({ x: 100, y: 200 })
    expect(outputs[1].spatial).toEqual({ x: 300, y: 400 })
  })

  test('uses null spatial when X/Y columns exist but row lacks valid pair', () => {
    const raw = `Time,Participant,Stimulus,AOI,X,Y
0,P1,S1,A1,,
1,P1,S1,A2,300,400`

    const rows = raw.split('\n')
    const header = rows[0].split(',')
    const sut = new CsvAdapter(header, ',')
    const { outputs, processRows } = createAdapterHarness(sut)
    processRows(rows.slice(1), { finalize: true })

    expect(outputs).toHaveLength(2)
    expect(outputs[0].spatial).toBeNull()
    expect(outputs[1].spatial).toEqual({ x: 300, y: 400 })
  })
})
