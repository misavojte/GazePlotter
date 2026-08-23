/**
 * Vitest tests for CsvSegmentedFromToRowParser
 *
 * @module CsvSegmentedFromToRowParser
 * @see src/lib/data/ingest/formats/lib/rows/CsvSegmentedFromToRowParser.ts
 */

import { CsvSegmentedFromToRowParser } from '$lib/data/ingest/formats/lib/rows/CsvSegmentedFromToRowParser'
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

  test.each([
    // [rowIndex, aoi, start, end, participant, stimulus]
    [1, ['Region_1'], 0, 1, 'Participant_1', 'Map_A'],
    [2, ['Region_1'], 1, 2, 'Participant_1', 'Map_A'],
    [3, ['Region_1'], 0, 5, 'Participant_2', 'Map_B'],
    [4, ['Region_1'], 5, 6, 'Participant_2', 'Map_A'],
    [5, ['Region_1', 'Region_2'], 6, 7, 'Participant_2', 'Map_A'],
  ])(
    'Process row %i as one segment',
    (rowIndex, aoi, start, end, participant, stimulus) => {
      const sut = new CsvSegmentedFromToRowParser(header, delim)
      const { outputs, processRow } = createAdapterHarness(sut)
      processRow(csvRows[rowIndex])
      expect(outputs[0]).toEqual({
        aoi,
        categoryId: 0,
        start,
        end,
        participant,
        stimulus,
      })
    }
  )

  test('Finalize', () => {
    const sut = new CsvSegmentedFromToRowParser(header, delim)
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
    const sut = new CsvSegmentedFromToRowParser(header, ',')
    const { outputs, processRows } = createAdapterHarness(sut)
    processRows(rows.slice(1), { finalize: true })

    expect(outputs).toHaveLength(2)
    expect(outputs[0].spatial).toEqual({ x: 640, y: 360 })
    expect(outputs[1].spatial).toBeNull()
  })
})
