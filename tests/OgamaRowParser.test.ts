/**
 * Vitest tests for OgamaRowParser
 *
 * Note that OGAMA data does not have time information, so the start and end of each segment
 * are just the index of the letter in the string.
 *
 * @module OgamaRowParser
 * @see $lib/data/ingest/formats/lib/rows/OgamaRowParser.ts
 */

import { OgamaRowParser } from '$lib/data/ingest/formats/lib/rows/OgamaRowParser'
import { test, expect, describe } from 'vitest'
import { createAdapterHarness } from './helpers/ingestAdapterHarness'

const ogamaMockDataOne = `Sequence Similarity,Scanpath string
Participant_1,ABCD
Participant_2,DBCA`

describe('OGAMA Deserializer - Single data', () => {
  const ogamaRows = ogamaMockDataOne.split('\n')
  const header = ogamaRows[0].split(',')
  const delim = ','
  const seg = (participant: string, letter: string, index: number) => ({
    aoi: [letter],
    categoryId: 0,
    start: index,
    end: index + 1,
    participant,
    stimulus: 'SimilarityXXX',
  })

  test('Process first row - one segment per scanpath letter', () => {
    const sut = new OgamaRowParser(header, 'SimilarityXXX.txt', delim)
    const { outputs, processRow } = createAdapterHarness(sut)
    processRow(ogamaRows[1])
    expect(outputs).toEqual([
      seg('Participant_1', 'A', 0),
      seg('Participant_1', 'B', 1),
      seg('Participant_1', 'C', 2),
      seg('Participant_1', 'D', 3),
    ])
  })

  test('Process second row - one segment per scanpath letter', () => {
    const sut = new OgamaRowParser(header, 'SimilarityXXX.txt', delim)
    const { outputs, processRow } = createAdapterHarness(sut)
    processRow(ogamaRows[2])
    expect(outputs).toEqual([
      seg('Participant_2', 'D', 0),
      seg('Participant_2', 'B', 1),
      seg('Participant_2', 'C', 2),
      seg('Participant_2', 'A', 3),
    ])
  })
})
