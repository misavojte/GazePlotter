/**
 * Vitest tests for BeGazeEyeDeserializer
 *
 * @module BeGazeEyeDeserializer
 * @see $lib/gaze-data/back-process/class/EyeDeserializer/BeGazeEyeDeserializer.ts
 */

import { BeGazeEyeDeserializer } from '$lib/gaze-data/back-process/class/EyeDeserializer/BeGazeEyeDeserializer'
import { test, expect, describe } from 'vitest'

const begazeMockData = `Event Start Trial Time [ms],Event End Trial Time [ms],Stimulus,Participant,Category,AOI Name
0,100,Map_A,Participant_1,Fixation,Region_1
100,200,Map_A,Participant_1,Fixation,Region_1
200,300,Map_A,Participant_1,Fixation,Region_1
300,400,Map_A,Participant_1,Fixation,Region_2
400,500,Map_A,Participant_1,Fixation,Region_3`

describe('BeGaze Deserializer - Single data', () => {
  const begazeRows = begazeMockData.split('\n')
  const header = begazeRows[0].split(',')
  const delim = ','
  test('Constructor', () => {
    const sut = new BeGazeEyeDeserializer(header, delim)
    expect(sut).toBeDefined()
    expect(sut.cStart).toBe(0)
    expect(sut.cEnd).toBe(1)
    expect(sut.cStimulus).toBe(2)
    expect(sut.cParticipant).toBe(3)
    expect(sut.cCategory).toBe(4)
    expect(sut.cAoi).toBe(5)
  })

  test('Process first row', () => {
    const sut = new BeGazeEyeDeserializer(header, delim)
    const result = sut.processRow(begazeRows[1])
    expect(result).toEqual({
      aoi: ['Region_1'],
      category: 'Fixation',
      end: '100',
      participant: 'Participant_1',
      start: '0',
      stimulus: 'Map_A',
    })
  })

  test('Process last row', () => {
    const sut = new BeGazeEyeDeserializer(header, delim)
    const result = sut.processRow(begazeRows[5])
    expect(result).toEqual({
      aoi: ['Region_3'],
      category: 'Fixation',
      end: '500',
      participant: 'Participant_1',
      start: '400',
      stimulus: 'Map_A',
    })
  })

  test('Process row with invalid category', () => {
    const sut = new BeGazeEyeDeserializer(header, delim)
    const result = sut.processRow(
      '0,100,Map_A,Participant_1,Separator,Region_1'
    )
    expect(result).toBeNull()
  })

  test('Process row with invalid start or end', () => {
    const sut = new BeGazeEyeDeserializer(header, delim)
    const result = sut.processRow('a,100,Map_A,Participant_1,Fixation,Region_1')
    expect(result).toBeNull()
  })
})
