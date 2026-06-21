/**
 * Vitest tests for BeGazeRowParser
 *
 * @module BeGazeRowParser
 * @see $lib/data/ingest/formats/lib/rows/BeGazeRowParser.ts
 */

import { BeGazeRowParser } from '$lib/data/ingest/formats/lib/rows/BeGazeRowParser'
import { it, expect, describe } from 'vitest'
import { createAdapterHarness } from './helpers/ingestAdapterHarness'

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
  it('Constructor', () => {
    const sut = new BeGazeRowParser(header, delim)
    expect(sut).toBeDefined()
    expect(sut.cStart).toBe(0)
    expect(sut.cEnd).toBe(1)
    expect(sut.cStimulus).toBe(2)
    expect(sut.cParticipant).toBe(3)
    expect(sut.cCategory).toBe(4)
    expect(sut.cAoi).toBe(5)
  })

  it('Process first row', () => {
    const sut = new BeGazeRowParser(header, delim)
    const { outputs, processRow } = createAdapterHarness(sut)
    processRow(begazeRows[1])
    const result = outputs[0]
    expect(result).toEqual({
      aoi: ['Region_1'],
      categoryId: 0,
      end: 100,
      participant: 'Participant_1',
      start: 0,
      stimulus: 'Map_A',
    })
  })

  it('Process last row', () => {
    const sut = new BeGazeRowParser(header, delim)
    const { outputs, processRow } = createAdapterHarness(sut)
    processRow(begazeRows[5])
    const result = outputs[0]
    expect(result).toEqual({
      aoi: ['Region_3'],
      categoryId: 0,
      end: 500,
      participant: 'Participant_1',
      start: 400,
      stimulus: 'Map_A',
    })
  })

  it('Process row with invalid category', () => {
    const sut = new BeGazeRowParser(header, delim)
    const { outputs, processRow } = createAdapterHarness(sut)
    processRow('0,100,Map_A,Participant_1,Separator,Region_1')
    expect(outputs).toHaveLength(0)
  })

  it('Process row with invalid start or end', () => {
    const sut = new BeGazeRowParser(header, delim)
    const { outputs, processRow } = createAdapterHarness(sut)
    processRow('a,100,Map_A,Participant_1,Fixation,Region_1')
    expect(outputs).toHaveLength(0)
  })
})

describe('BeGaze Deserializer - categories', () => {
  const header = begazeMockData.split('\n')[0].split(',')

  it('preserves distinct event types as distinct categories', () => {
    const sut = new BeGazeRowParser(header, ',')
    const { outputs, processRow } = createAdapterHarness(sut)
    processRow('0,100,Map_A,P1,Fixation,Region_1')
    processRow('100,150,Map_A,P1,Saccade,Region_1')
    processRow('150,200,Map_A,P1,Blink,Region_1')
    // Fixation reserved at 0; Saccade and Blink stay distinct (not collapsed).
    expect(outputs.map(o => o.categoryId)).toEqual([0, 1, 2])
  })

  it('folds an empty category cell into Saccade (no blank-named category)', () => {
    const sut = new BeGazeRowParser(header, ',')
    const { outputs, processRow } = createAdapterHarness(sut)
    processRow('0,100,Map_A,P1,,Region_1') // empty category
    processRow('100,150,Map_A,P1,Saccade,Region_1')
    expect(outputs.map(o => o.categoryId)).toEqual([1, 1])
  })
})
