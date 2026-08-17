/**
 * Vitest tests for CsvSegmentedDurationRowParser
 *
 * This test suite validates the functionality of the CsvSegmentedDurationRowParser,
 * which processes CSV files containing segmented eye-tracking data with duration-based timing.
 *
 * @module CsvSegmentedDurationRowParser
 * @see src/lib/data/ingest/formats/lib/rows/CsvSegmentedDurationRowParser.ts
 */

import { CsvSegmentedDurationRowParser } from '$lib/data/ingest/formats/lib/rows/CsvSegmentedDurationRowParser'
import { test, expect, describe } from 'vitest'
import {
  collectAdapterOutputs as collectOutputs,
  processAdapterRow as processRow,
} from './helpers/ingestAdapterHarness'
import { encodeString } from '$lib/data/ingest/utils/byteUtils'

/**
 * Mock CSV data representing eye-tracking segments with duration-based timing.
 * Format: stimulus, participant, timestamp, duration, eyemovementtype, AOI
 * - eyemovementtype: 0 = Fixation, 1 = Saccade
 * - Empty AOI values are allowed
 */
const csvMockDataOne = `stimulus,participant,timestamp,duration,eyemovementtype,AOI
SMI Base,Anna,226.2,72,1,
SMI Base,Anna,298.2,120,0,Map
SMI Base,Anna,418.2,28,1,
SMI Base,Anna,446.2,208,0,Map
SMI Base,Anna,654.2,36,1,
SMI Base,Anna,690.2,100,0,Map|Button`

/**
 * Mock CSV data with multiple participants and stimuli
 */
const csvMockDataMultiple = `stimulus,participant,timestamp,duration,eyemovementtype,AOI
Map_A,Participant_1,100,50,0,Region_1
Map_A,Participant_1,150,25,1,
Map_A,Participant_1,175,100,0,Region_2
Map_B,Participant_2,200,75,0,Region_3
Map_B,Participant_2,275,30,1,
Map_B,Participant_2,305,90,0,Region_1`

/**
 * Mock CSV data with edge cases: missing required fields
 */
const csvMockDataInvalid = `stimulus,participant,timestamp,duration,eyemovementtype,AOI
Map_A,Participant_1,100,50,0,Region_1
Map_A,,100,50,0,Region_1
Map_A,Participant_1,,50,0,Region_1
Map_A,Participant_1,100,,0,Region_1
,Participant_1,100,50,0,Region_1`

const csvRows = csvMockDataOne.split('\n')
// All three mocks share this 6-column header line.
const header = csvRows[0].split(',')
const delim = ','

describe('CsvSegmentedDurationRowParser - Constructor', () => {
  test('Constructor throws error when required column is missing', () => {
    // Create a header missing the 'timestamp' column
    const invalidHeader = [
      'stimulus',
      'participant',
      'duration',
      'eyemovementtype',
      'AOI',
    ]

    // Expect the constructor to throw an error due to missing required field
    expect(() => {
      new CsvSegmentedDurationRowParser(invalidHeader, delim)
    }).toThrow('Column timestamp not found')
  })
})

describe('CsvSegmentedDurationRowParser - Single data processing', () => {
  test('processes all six rows, normalized to the first-row base time 226.2', () => {
    const sut = new CsvSegmentedDurationRowParser(header, delim)
    const outputs = collectOutputs(sut)
    for (const row of csvRows.slice(1)) processRow(sut, row)

    const seg = { participant: 'Anna', stimulus: 'SMI Base' }
    // categoryId: 0 = Fixation, 1 = Saccade; empty AOI cell becomes null.
    // Rows 5-6 use closeTo: 654.2 - 226.2 = 428.00000000000006 (float error).
    expect(outputs).toEqual([
      { ...seg, aoi: null, categoryId: 1, start: 0, end: 72 },
      { ...seg, aoi: ['Map'], categoryId: 0, start: 72, end: 192 },
      { ...seg, aoi: null, categoryId: 1, start: 192, end: 220 },
      { ...seg, aoi: ['Map'], categoryId: 0, start: 220, end: 428 },
      {
        ...seg,
        aoi: null,
        categoryId: 1,
        start: expect.closeTo(428, 10),
        end: expect.closeTo(464, 10),
      },
      {
        ...seg,
        aoi: ['Map', 'Button'],
        categoryId: 0,
        start: expect.closeTo(464, 5),
        end: expect.closeTo(564, 5),
      },
    ])
  })
})

describe('CsvSegmentedDurationRowParser - Multiple participants and stimuli', () => {
  const multiRows = csvMockDataMultiple.split('\n')

  test('Process row for Participant_1 with Map_A (establishes base time 100)', () => {
    const sut = new CsvSegmentedDurationRowParser(header, delim)
    const outputs = collectOutputs(sut)
    processRow(sut, multiRows[1])
    const result = outputs[0]

    expect(result).toBeDefined()
    expect(result.aoi).toEqual(['Region_1'])
    expect(result.categoryId).toEqual(0)

    // First row for Participant_1/Map_A establishes base time of 100
    // Normalized start = 100 - 100 = 0
    // Normalized end = 0 + 50 = 50
    expect(result.start).toEqual(0)
    expect(result.end).toEqual(50)

    expect(result.participant).toEqual('Participant_1')
    expect(result.stimulus).toEqual('Map_A')
  })

  test('Process saccade without AOI for Participant_1 (uses base time 100)', () => {
    const sut = new CsvSegmentedDurationRowParser(header, delim)
    const outputs = collectOutputs(sut)
    // Process first row to establish base time
    processRow(sut, multiRows[1])
    // Process second row
    processRow(sut, multiRows[2])
    const result = outputs[1]

    expect(result).toBeDefined()
    expect(result.aoi).toBeNull()
    expect(result.categoryId).toEqual(1)

    // Uses base time 100 from first row
    // Normalized start = 150 - 100 = 50
    // Normalized end = 50 + 25 = 75
    expect(result.start).toEqual(50)
    expect(result.end).toEqual(75)

    expect(result.participant).toEqual('Participant_1')
    expect(result.stimulus).toEqual('Map_A')
  })

  test('Process row for Participant_2 with Map_B (resets base time to 200)', () => {
    const sut = new CsvSegmentedDurationRowParser(header, delim)
    const outputs = collectOutputs(sut)
    // Process some Participant_1 rows first
    processRow(sut, multiRows[1])
    processRow(sut, multiRows[2])
    // Now process Participant_2 row - should reset base time
    processRow(sut, multiRows[4])
    const result = outputs[2]

    expect(result).toBeDefined()
    expect(result.aoi).toEqual(['Region_3'])
    expect(result.categoryId).toEqual(0)

    // New participant/stimulus combination resets base time to 200
    // Normalized start = 200 - 200 = 0
    // Normalized end = 0 + 75 = 75
    expect(result.start).toEqual(0)
    expect(result.end).toEqual(75)

    expect(result.participant).toEqual('Participant_2')
    expect(result.stimulus).toEqual('Map_B')
  })

  test('Base time resets when switching participants', () => {
    const sut = new CsvSegmentedDurationRowParser(header, delim)
    const outputs = collectOutputs(sut)

    // Process Participant_1, Map_A row (base time = 100)
    processRow(sut, multiRows[1])
    const result1 = outputs[0]
    expect(result1.start).toEqual(0) // 100 - 100
    expect(result1.participant).toEqual('Participant_1')

    // Switch to Participant_2, Map_B (base time resets to 200)
    processRow(sut, multiRows[4])
    const result2 = outputs[1]
    expect(result2.start).toEqual(0) // 200 - 200
    expect(result2.participant).toEqual('Participant_2')

    // Continue with Participant_2, Map_B (uses base time 200)
    processRow(sut, multiRows[5])
    const result3 = outputs[2]
    expect(result3.start).toEqual(75) // 275 - 200
    expect(result3.participant).toEqual('Participant_2')
  })
})

describe('CsvSegmentedDurationRowParser - Invalid data handling', () => {
  const invalidRows = csvMockDataInvalid.split('\n')

  test('Valid row returns proper result', () => {
    const sut = new CsvSegmentedDurationRowParser(header, delim)
    const outputs = collectOutputs(sut)
    processRow(sut, invalidRows[1])
    const result = outputs[0]

    // Valid row should return proper result
    expect(result).toBeDefined()
    expect(result.participant).toEqual('Participant_1')
  })

  // Empty required field should return null (filtered out by pipeline)
  test.each([
    ['participant', 2],
    ['timestamp', 3],
    ['duration', 4],
    ['stimulus', 5],
  ])('Row with empty %s returns null', (_field, rowIndex) => {
    const sut = new CsvSegmentedDurationRowParser(header, delim)
    const outputs = collectOutputs(sut)
    processRow(sut, invalidRows[rowIndex])
    expect(outputs).toHaveLength(0)
  })
})

describe('CsvSegmentedDurationRowParser - Time calculation accuracy', () => {
  test('Integer time values calculate correctly with normalization', () => {
    const sut = new CsvSegmentedDurationRowParser(header, ',')
    const row = 'Stimulus,Participant,1000,500,0,Region'
    const outputs = collectOutputs(sut)
    processRow(sut, row)
    const result = outputs[0]

    // First row establishes base time of 1000
    // Normalized start = 1000 - 1000 = 0
    // Normalized end = 0 + 500 = 500
    expect(result.start).toEqual(0)
    expect(result.end).toEqual(500)
  })

  test('Decimal time values calculate correctly with normalization', () => {
    const sut = new CsvSegmentedDurationRowParser(header, ',')
    const row = 'Stimulus,Participant,123.456,78.9,0,Region'
    const outputs = collectOutputs(sut)
    processRow(sut, row)
    const result = outputs[0]

    // First row establishes base time of 123.456
    // Normalized start = 123.456 - 123.456 = 0
    // Normalized end = 0 + 78.9 = 78.9
    expect(result.start).toEqual(0)
    expect(result.end).toEqual(78.9)
  })

  test('Zero duration calculates correctly', () => {
    const sut = new CsvSegmentedDurationRowParser(header, ',')
    const row = 'Stimulus,Participant,100,0,1,'
    const outputs = collectOutputs(sut)
    processRow(sut, row)
    const result = outputs[0]

    // First row establishes base time of 100
    // Normalized start = 100 - 100 = 0
    // Normalized end = 0 + 0 = 0 (start and end are the same)
    expect(result.start).toEqual(0)
    expect(result.end).toEqual(0)
  })

  test('Subsequent rows use normalized time from base', () => {
    const sut = new CsvSegmentedDurationRowParser(header, ',')
    const outputs = collectOutputs(sut)

    // First row establishes base time of 1000
    processRow(sut, 'Stimulus,Participant,1000,500,0,Region')
    const result1 = outputs[0]
    expect(result1.start).toEqual(0)
    expect(result1.end).toEqual(500)

    // Second row uses base time 1000
    processRow(sut, 'Stimulus,Participant,1500,300,1,')
    const result2 = outputs[1]
    expect(result2.start).toEqual(500) // 1500 - 1000
    expect(result2.end).toEqual(800) // 500 + 300
  })
})

describe('CsvSegmentedDurationRowParser - Eye movement type classification', () => {
  // Numeric codes: 0 = Fixation, any non-zero collapses to Saccade.
  test.each([
    ['0', 0],
    ['1', 1],
    ['2', 1],
  ])('Eye movement type %s maps to categoryId %i', (code, categoryId) => {
    const sut = new CsvSegmentedDurationRowParser(header, ',')
    const outputs = collectOutputs(sut)
    processRow(sut, `Stimulus,Participant,100,50,${code},Region`)

    expect(outputs[0].categoryId).toEqual(categoryId)
  })

  // GazePlotter's own segmented export writes the category NAME (e.g.
  // "Fixation") into eyemovementtype, so re-import must recognise it by name.
  test.each(['Fixation', 'fixation', 'FIXATION'])(
    'Eye movement type "%s" maps to Fixation',
    token => {
      const sut = new CsvSegmentedDurationRowParser(header, ',')
      const outputs = collectOutputs(sut)
      processRow(sut, `Stimulus,Participant,100,50,${token},Region`)
      expect(outputs[0].categoryId).toEqual(0)
    }
  )

  test('numeric non-zero codes have no name and collapse to one Saccade category', () => {
    const sut = new CsvSegmentedDurationRowParser(header, ',')
    const outputs = collectOutputs(sut)
    processRow(sut, 'Stimulus,Participant,100,50,1,Region')
    processRow(sut, 'Stimulus,Participant,200,50,2,Region')
    processRow(sut, 'Stimulus,Participant,300,50,3,Region')
    expect(outputs.map(o => o.categoryId)).toEqual([1, 1, 1])
  })

  test('named non-fixation types are preserved as distinct categories', () => {
    const sut = new CsvSegmentedDurationRowParser(header, ',')
    const outputs = collectOutputs(sut)
    processRow(sut, 'Stimulus,Participant,100,50,Fixation,Region')
    processRow(sut, 'Stimulus,Participant,200,50,Saccade,Region')
    processRow(sut, 'Stimulus,Participant,300,50,Unclassified,Region')
    processRow(sut, 'Stimulus,Participant,400,50,EyesNotFound,Region')
    // Fixation reserved at 0; each new name gets the next id.
    expect(outputs.map(o => o.categoryId)).toEqual([0, 1, 2, 3])
  })

  test('an empty eyemovementtype collapses to Saccade, not a phantom blank category', () => {
    const sut = new CsvSegmentedDurationRowParser(header, ',')
    const outputs = collectOutputs(sut)
    processRow(sut, 'Stimulus,Participant,100,50,,Region') // empty type
    processRow(sut, 'Stimulus,Participant,200,50,1,Region') // numeric Saccade
    // Both share the single Saccade category; no extra empty-named category.
    expect(outputs.map(o => o.categoryId)).toEqual([1, 1])
  })

  test('classifies tokens correctly under utf-16le encoding', () => {
    const sut = new CsvSegmentedDurationRowParser(header, ',', 'utf-16le')
    const outputs = collectOutputs(sut)
    const feed = (row: string) =>
      sut.processRowBytes(encodeString(row, 'utf-16le'))
    feed('Stimulus,Participant,100,50,0,Region') // "0" -> Fixation
    feed('Stimulus,Participant,200,50,Saccade,Region') // named -> distinct
    feed('Stimulus,Participant,300,50,5,Region') // numeric non-zero -> Saccade
    expect(outputs.map(o => o.categoryId)).toEqual([0, 1, 1])
  })
})

describe('CsvSegmentedDurationRowParser - Finalize', () => {
  test('Finalize returns null (no state to finalize)', () => {
    const header = [
      'stimulus',
      'participant',
      'timestamp',
      'duration',
      'eyemovementtype',
      'AOI',
    ]
    const sut = new CsvSegmentedDurationRowParser(header, ',')
    const row = 'Stimulus,Participant,100,50,0,Region'
    const outputs = collectOutputs(sut)

    // Process a row
    processRow(sut, row)

    // Finalize should return null since this deserializer doesn't maintain state
    const result = sut.finalize()
    expect(result).toBeUndefined()
    expect(outputs).toHaveLength(1)
  })

  test('Finalize can be called without processing any rows', () => {
    const header = [
      'stimulus',
      'participant',
      'timestamp',
      'duration',
      'eyemovementtype',
      'AOI',
    ]
    const sut = new CsvSegmentedDurationRowParser(header, ',')

    // Finalize without processing any rows should not throw
    expect(() => {
      const result = sut.finalize()
      expect(result).toBeUndefined()
    }).not.toThrow()
  })
})

describe('CsvSegmentedDurationRowParser - Spatial coordinates', () => {
  test('parses optional X/Y columns', () => {
    const raw = `stimulus,participant,timestamp,duration,eyemovementtype,AOI,X,Y
S1,P1,100,50,0,A1,10,20
S1,P1,150,50,1,,,
S1,P1,200,50,0,A2,30,40`

    const rows = raw.split('\n')
    const header = rows[0].split(',')
    const sut = new CsvSegmentedDurationRowParser(header, ',')
    const outputs = collectOutputs(sut)

    processRow(sut, rows[1])
    processRow(sut, rows[2])
    processRow(sut, rows[3])

    expect(outputs).toHaveLength(3)
    expect(outputs[0].spatial).toEqual({ x: 10, y: 20 })
    expect(outputs[1].spatial).toBeNull()
    expect(outputs[2].spatial).toEqual({ x: 30, y: 40 })
  })
})
