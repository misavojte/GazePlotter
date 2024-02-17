import type { SingleDeserializerOutput } from '$lib/type/DeserializerOutput/SingleDeserializerOutput/SingleDeserializerOutput.ts'
import { CsvEyeDeserializer } from '../src/lib/class/Eye/EyeDeserializer/CsvEyeDeserializer.ts'
import { csvMockDataOne, csvMockDataTwo } from './mockData/csvMockData.ts'
import { test, expect, describe } from 'vitest'

describe('CSV Deserializer - Single data', () => {
  const csvRows = csvMockDataOne.split('\n')
  const header = csvRows[0].split(',')
  test('Constructor', () => {
    const sut = new CsvEyeDeserializer(header)
    expect(sut).toBeDefined()
    expect(sut.cAoi).toBe(3)
    expect(sut.cParticipant).toBe(1)
    expect(sut.cStimulus).toBe(2)
    expect(sut.cTime).toBe(0)
  })

  test('Process first row', () => {
    const sut = new CsvEyeDeserializer(header)
    const row = csvRows[1].split(',')
    const result = sut.deserialize(row)
    expect(result).toBeNull()
    expect(sut.mAoi).toEqual('Region_1')
    expect(sut.mParticipant).toEqual('Participant_1')
    expect(sut.mStimulus).toEqual('Map_A')
    expect(sut.mTimeBase).toEqual(0)
    expect(sut.mTimeStart).toEqual('0')
    expect(sut.mTimeLast).toEqual('0')
  })

  test('Process first segment', () => {
    const sut = new CsvEyeDeserializer(header)
    const row1 = csvRows[1].split(',')
    const row2 = csvRows[2].split(',')
    const row3 = csvRows[3].split(',')
    const row4 = csvRows[4].split(',')

    void sut.deserialize(row1)
    void sut.deserialize(row2)
    void sut.deserialize(row3)
    const result = sut.deserialize(row4)

    expect(result).toEqual({
      aoi: ['Region_1'],
      category: 'Fixation',
      start: '0',
      end: '2',
      participant: 'Participant_1',
      stimulus: 'Map_A',
    })
  })

  test('Process second segment', () => {
    const sut = new CsvEyeDeserializer(header)

    const row1 = csvRows[1].split(',')
    const row2 = csvRows[2].split(',')
    const row3 = csvRows[3].split(',')
    const row4 = csvRows[4].split(',')
    const row5 = csvRows[5].split(',')

    void sut.deserialize(row1)
    void sut.deserialize(row2)
    void sut.deserialize(row3)
    void sut.deserialize(row4)
    const result = sut.deserialize(row5)

    expect(result).toEqual({
      aoi: ['Region_2'],
      category: 'Fixation',
      start: '3',
      end: '3',
      participant: 'Participant_1',
      stimulus: 'Map_A',
    })

    // BEWARE! If only one timestamp for whole segment, start and end are the same!
  })

  test('Sample 2 - baseTime between segments', () => {
    const sut = new CsvEyeDeserializer(header)
    const csvRows2 = csvMockDataTwo.split('\n')
    const row1 = csvRows2[1].split(',')
    const row2 = csvRows2[2].split(',')
    const row3 = csvRows2[3].split(',')
    const row4 = csvRows2[4].split(',')
    void sut.deserialize(row1)
    void sut.deserialize(row2)
    void sut.deserialize(row3)
    const result = sut.deserialize(row4)
    expect(result).toEqual({
      aoi: ['Region_4'],
      category: 'Fixation',
      start: '1',
      end: '2',
      participant: 'Participant_1',
      stimulus: 'Map_A',
    })
  })

  test('Sample 2 - no duplicity segments with 0,0', () => {
    const sut = new CsvEyeDeserializer(header)
    const csvRows2 = csvMockDataTwo.split('\n')
    const row1 = csvRows2[1].split(',')
    const row2 = csvRows2[2].split(',')
    const row3 = csvRows2[3].split(',')
    const row4 = csvRows2[4].split(',')
    const row5 = csvRows2[5].split(',')
    void sut.deserialize(row1)
    void sut.deserialize(row2)
    void sut.deserialize(row3)
    void sut.deserialize(row4)
    const result = sut.deserialize(row5)
    expect(result).toBeNull()
  })
})

describe('CSV Deserializer - Multiple data', async () => {
  test('Mock Data One', async () => {
    const rows = csvMockDataOne.split('\n')
    const header = rows[0].split(',')
    const sut = new CsvEyeDeserializer(header)
    const result: SingleDeserializerOutput[] = []

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      const a = sut.deserialize(row.split(','))
      if (a) result.push(a)
    }

    console.log(result)

    expect(result.length).toBe(4)
    expect(result[0].stimulus).toEqual('Map_A')
    expect(result[1].stimulus).toEqual('Map_B')
    expect(result[2].stimulus).toEqual('Map_C')
    expect(result[3].stimulus).toEqual('Map_D')

    expect(result[0].participant).toEqual('Participant_1')
    expect(result[1].participant).toEqual('Participant_2')
    expect(result[2].participant).toEqual('Participant_3')
    expect(result[3].participant).toEqual('Participant_4')

    expect(result[0].aoi).toEqual(['Region_1'])
    expect(result[1].aoi).toEqual(['Region_2'])
    expect(result[2].aoi).toEqual(['Region_3'])
    expect(result[3].aoi).toEqual(['Region_4'])
  })
})
