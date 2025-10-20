/**
 * Vitest tests for CsvSegmentedDurationEyeDeserializer
 * 
 * This test suite validates the functionality of the CsvSegmentedDurationEyeDeserializer,
 * which processes CSV files containing segmented eye-tracking data with duration-based timing.
 * 
 * @module CsvSegmentedDurationEyeDeserializer
 * @see src/lib/gaze-data/back-process/class/EyeDeserializer/CsvSegmentedDurationEyeDeserializer.ts
 */

import { CsvSegmentedDurationEyeDeserializer } from '$lib/gaze-data/back-process/class/EyeDeserializer/CsvSegmentedDurationEyeDeserializer'
import type { SingleDeserializerOutput } from '$lib/gaze-data/back-process/types/SingleDeserializerOutput'
import { test, expect, describe } from 'vitest'

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
SMI Base,Anna,654.2,36,1,`

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

describe('CsvSegmentedDurationEyeDeserializer - Constructor', () => {
  const csvRows = csvMockDataOne.split('\n')
  const header = csvRows[0].split(',')

  test('Constructor initializes column indices correctly', () => {
    // Create a new deserializer instance with the header
    const sut = new CsvSegmentedDurationEyeDeserializer(header)
    
    // Verify the deserializer was created
    expect(sut).toBeDefined()
    
    // Verify column indices are correctly mapped from the header
    // Column order: stimulus(0), participant(1), timestamp(2), duration(3), eyemovementtype(4), AOI(5)
    expect(sut.cStimulus).toBe(0)
    expect(sut.cParticipant).toBe(1)
    expect(sut.cTimestamp).toBe(2)
    expect(sut.cDuration).toBe(3)
    expect(sut.cEyeMovementType).toBe(4)
    expect(sut.cAoi).toBe(5)
  })

  test('Constructor throws error when required column is missing', () => {
    // Create a header missing the 'timestamp' column
    const invalidHeader = ['stimulus', 'participant', 'duration', 'eyemovementtype', 'AOI']
    
    // Expect the constructor to throw an error due to missing required field
    expect(() => {
      new CsvSegmentedDurationEyeDeserializer(invalidHeader)
    }).toThrow('Column timestamp not found')
  })
})

describe('CsvSegmentedDurationEyeDeserializer - Single data processing', () => {
  const csvRows = csvMockDataOne.split('\n')
  const header = csvRows[0].split(',')

  test('Process first row - Saccade with empty AOI (establishes base time)', () => {
    const sut = new CsvSegmentedDurationEyeDeserializer(header)
    const row = csvRows[1].split(',')
    const result = sut.deserialize(row) as SingleDeserializerOutput
    
    // Verify the result is defined
    expect(result).toBeDefined()
    
    // Verify AOI is null for empty string
    expect(result.aoi).toBeNull()
    
    // Verify eye movement type: 1 = Saccade
    expect(result.category).toEqual('Saccade')
    
    // Verify time normalization: first row establishes base time of 226.2
    // Normalized start = 226.2 - 226.2 = 0
    // Normalized end = 0 + 72 = 72
    expect(result.start).toEqual('0')
    expect(result.end).toEqual('72')
    
    // Verify participant and stimulus are correctly extracted
    expect(result.participant).toEqual('Anna')
    expect(result.stimulus).toEqual('SMI Base')
  })

  test('Process second row - Fixation with AOI (uses established base time)', () => {
    const sut = new CsvSegmentedDurationEyeDeserializer(header)
    // Process first row to establish base time
    sut.deserialize(csvRows[1].split(','))
    // Now process second row
    const row = csvRows[2].split(',')
    const result = sut.deserialize(row) as SingleDeserializerOutput
    
    expect(result).toBeDefined()
    
    // Verify AOI is wrapped in array when present
    expect(result.aoi).toEqual(['Map'])
    
    // Verify eye movement type: 0 = Fixation
    expect(result.category).toEqual('Fixation')
    
    // Verify time normalization: base time is 226.2
    // Normalized start = 298.2 - 226.2 = 72
    // Normalized end = 72 + 120 = 192
    expect(result.start).toEqual('72')
    expect(result.end).toEqual('192')
    
    expect(result.participant).toEqual('Anna')
    expect(result.stimulus).toEqual('SMI Base')
  })

  test('Process third row - Saccade with empty AOI', () => {
    const sut = new CsvSegmentedDurationEyeDeserializer(header)
    // Process first two rows to establish base time
    sut.deserialize(csvRows[1].split(','))
    sut.deserialize(csvRows[2].split(','))
    // Now process third row
    const row = csvRows[3].split(',')
    const result = sut.deserialize(row) as SingleDeserializerOutput
    
    expect(result).toBeDefined()
    expect(result.aoi).toBeNull()
    expect(result.category).toEqual('Saccade')
    
    // Verify time normalization: base time is 226.2
    // Normalized start = 418.2 - 226.2 = 192
    // Normalized end = 192 + 28 = 220
    expect(result.start).toEqual('192')
    expect(result.end).toEqual('220')
    
    expect(result.participant).toEqual('Anna')
    expect(result.stimulus).toEqual('SMI Base')
  })

  test('Process fourth row - Fixation with AOI and longer duration', () => {
    const sut = new CsvSegmentedDurationEyeDeserializer(header)
    // Process previous rows to establish base time
    sut.deserialize(csvRows[1].split(','))
    sut.deserialize(csvRows[2].split(','))
    sut.deserialize(csvRows[3].split(','))
    // Now process fourth row
    const row = csvRows[4].split(',')
    const result = sut.deserialize(row) as SingleDeserializerOutput
    
    expect(result).toBeDefined()
    expect(result.aoi).toEqual(['Map'])
    expect(result.category).toEqual('Fixation')
    
    // Verify time normalization: base time is 226.2
    // Normalized start = 446.2 - 226.2 = 220
    // Normalized end = 220 + 208 = 428
    expect(result.start).toEqual('220')
    expect(result.end).toEqual('428')
    
    expect(result.participant).toEqual('Anna')
    expect(result.stimulus).toEqual('SMI Base')
  })

  test('Process fifth row - Saccade with empty AOI', () => {
    const sut = new CsvSegmentedDurationEyeDeserializer(header)
    // Process previous rows to establish base time
    sut.deserialize(csvRows[1].split(','))
    sut.deserialize(csvRows[2].split(','))
    sut.deserialize(csvRows[3].split(','))
    sut.deserialize(csvRows[4].split(','))
    // Now process fifth row
    const row = csvRows[5].split(',')
    const result = sut.deserialize(row) as SingleDeserializerOutput
    
    expect(result).toBeDefined()
    expect(result.aoi).toBeNull()
    expect(result.category).toEqual('Saccade')
    
    // Verify time normalization: base time is 226.2
    // Normalized start = 654.2 - 226.2 = 428.00000000000006 (floating point precision)
    // Normalized end = 428.00000000000006 + 36 = 464.00000000000006
    // Note: The fourth row has duration 208.00000000000006 which causes floating point precision issues
    expect(Number(result.start)).toBeCloseTo(428, 10)
    expect(Number(result.end)).toBeCloseTo(464, 10)
    
    expect(result.participant).toEqual('Anna')
    expect(result.stimulus).toEqual('SMI Base')
  })
})

describe('CsvSegmentedDurationEyeDeserializer - Multiple participants and stimuli', () => {
  const csvRows = csvMockDataMultiple.split('\n')
  const header = csvRows[0].split(',')

  test('Process row for Participant_1 with Map_A (establishes base time 100)', () => {
    const sut = new CsvSegmentedDurationEyeDeserializer(header)
    const row = csvRows[1].split(',')
    const result = sut.deserialize(row) as SingleDeserializerOutput
    
    expect(result).toBeDefined()
    expect(result.aoi).toEqual(['Region_1'])
    expect(result.category).toEqual('Fixation')
    
    // First row for Participant_1/Map_A establishes base time of 100
    // Normalized start = 100 - 100 = 0
    // Normalized end = 0 + 50 = 50
    expect(result.start).toEqual('0')
    expect(result.end).toEqual('50')
    
    expect(result.participant).toEqual('Participant_1')
    expect(result.stimulus).toEqual('Map_A')
  })

  test('Process saccade without AOI for Participant_1 (uses base time 100)', () => {
    const sut = new CsvSegmentedDurationEyeDeserializer(header)
    // Process first row to establish base time
    sut.deserialize(csvRows[1].split(','))
    // Process second row
    const row = csvRows[2].split(',')
    const result = sut.deserialize(row) as SingleDeserializerOutput
    
    expect(result).toBeDefined()
    expect(result.aoi).toBeNull()
    expect(result.category).toEqual('Saccade')
    
    // Uses base time 100 from first row
    // Normalized start = 150 - 100 = 50
    // Normalized end = 50 + 25 = 75
    expect(result.start).toEqual('50')
    expect(result.end).toEqual('75')
    
    expect(result.participant).toEqual('Participant_1')
    expect(result.stimulus).toEqual('Map_A')
  })

  test('Process row for Participant_2 with Map_B (resets base time to 200)', () => {
    const sut = new CsvSegmentedDurationEyeDeserializer(header)
    // Process some Participant_1 rows first
    sut.deserialize(csvRows[1].split(','))
    sut.deserialize(csvRows[2].split(','))
    // Now process Participant_2 row - should reset base time
    const row = csvRows[4].split(',')
    const result = sut.deserialize(row) as SingleDeserializerOutput
    
    expect(result).toBeDefined()
    expect(result.aoi).toEqual(['Region_3'])
    expect(result.category).toEqual('Fixation')
    
    // New participant/stimulus combination resets base time to 200
    // Normalized start = 200 - 200 = 0
    // Normalized end = 0 + 75 = 75
    expect(result.start).toEqual('0')
    expect(result.end).toEqual('75')
    
    expect(result.participant).toEqual('Participant_2')
    expect(result.stimulus).toEqual('Map_B')
  })

  test('Base time resets when switching participants', () => {
    const sut = new CsvSegmentedDurationEyeDeserializer(header)
    
    // Process Participant_1, Map_A row (base time = 100)
    const result1 = sut.deserialize(csvRows[1].split(',')) as SingleDeserializerOutput
    expect(result1.start).toEqual('0') // 100 - 100
    expect(result1.participant).toEqual('Participant_1')
    
    // Switch to Participant_2, Map_B (base time resets to 200)
    const result2 = sut.deserialize(csvRows[4].split(',')) as SingleDeserializerOutput
    expect(result2.start).toEqual('0') // 200 - 200
    expect(result2.participant).toEqual('Participant_2')
    
    // Continue with Participant_2, Map_B (uses base time 200)
    const result3 = sut.deserialize(csvRows[5].split(',')) as SingleDeserializerOutput
    expect(result3.start).toEqual('75') // 275 - 200
    expect(result3.participant).toEqual('Participant_2')
  })
})

describe('CsvSegmentedDurationEyeDeserializer - Invalid data handling', () => {
  const csvRows = csvMockDataInvalid.split('\n')
  const header = csvRows[0].split(',')

  test('Valid row returns proper result', () => {
    const sut = new CsvSegmentedDurationEyeDeserializer(header)
    const row = csvRows[1].split(',')
    const result = sut.deserialize(row) as SingleDeserializerOutput
    
    // Valid row should return proper result
    expect(result).toBeDefined()
    expect(result.participant).toEqual('Participant_1')
  })

  test('Row with empty participant returns null', () => {
    const sut = new CsvSegmentedDurationEyeDeserializer(header)
    const row = csvRows[2].split(',')
    const result = sut.deserialize(row)
    
    // Empty required field should return null (filtered out by pipeline)
    expect(result).toBeNull()
  })

  test('Row with empty timestamp returns null', () => {
    const sut = new CsvSegmentedDurationEyeDeserializer(header)
    const row = csvRows[3].split(',')
    const result = sut.deserialize(row)
    
    // Empty required field should return null
    expect(result).toBeNull()
  })

  test('Row with empty duration returns null', () => {
    const sut = new CsvSegmentedDurationEyeDeserializer(header)
    const row = csvRows[4].split(',')
    const result = sut.deserialize(row)
    
    // Empty required field should return null
    expect(result).toBeNull()
  })

  test('Row with empty stimulus returns null', () => {
    const sut = new CsvSegmentedDurationEyeDeserializer(header)
    const row = csvRows[5].split(',')
    const result = sut.deserialize(row)
    
    // Empty required field should return null
    expect(result).toBeNull()
  })
})

describe('CsvSegmentedDurationEyeDeserializer - Time calculation accuracy', () => {
  test('Integer time values calculate correctly with normalization', () => {
    const header = ['stimulus', 'participant', 'timestamp', 'duration', 'eyemovementtype', 'AOI']
    const sut = new CsvSegmentedDurationEyeDeserializer(header)
    const row = ['Stimulus', 'Participant', '1000', '500', '0', 'Region']
    const result = sut.deserialize(row) as SingleDeserializerOutput
    
    // First row establishes base time of 1000
    // Normalized start = 1000 - 1000 = 0
    // Normalized end = 0 + 500 = 500
    expect(result.start).toEqual('0')
    expect(result.end).toEqual('500')
  })

  test('Decimal time values calculate correctly with normalization', () => {
    const header = ['stimulus', 'participant', 'timestamp', 'duration', 'eyemovementtype', 'AOI']
    const sut = new CsvSegmentedDurationEyeDeserializer(header)
    const row = ['Stimulus', 'Participant', '123.456', '78.9', '0', 'Region']
    const result = sut.deserialize(row) as SingleDeserializerOutput
    
    // First row establishes base time of 123.456
    // Normalized start = 123.456 - 123.456 = 0
    // Normalized end = 0 + 78.9 = 78.9
    expect(result.start).toEqual('0')
    expect(result.end).toEqual('78.9')
  })

  test('Zero duration calculates correctly', () => {
    const header = ['stimulus', 'participant', 'timestamp', 'duration', 'eyemovementtype', 'AOI']
    const sut = new CsvSegmentedDurationEyeDeserializer(header)
    const row = ['Stimulus', 'Participant', '100', '0', '1', '']
    const result = sut.deserialize(row) as SingleDeserializerOutput
    
    // First row establishes base time of 100
    // Normalized start = 100 - 100 = 0
    // Normalized end = 0 + 0 = 0 (start and end are the same)
    expect(result.start).toEqual('0')
    expect(result.end).toEqual('0')
  })

  test('Subsequent rows use normalized time from base', () => {
    const header = ['stimulus', 'participant', 'timestamp', 'duration', 'eyemovementtype', 'AOI']
    const sut = new CsvSegmentedDurationEyeDeserializer(header)
    
    // First row establishes base time of 1000
    const row1 = ['Stimulus', 'Participant', '1000', '500', '0', 'Region']
    const result1 = sut.deserialize(row1) as SingleDeserializerOutput
    expect(result1.start).toEqual('0')
    expect(result1.end).toEqual('500')
    
    // Second row uses base time 1000
    const row2 = ['Stimulus', 'Participant', '1500', '300', '1', '']
    const result2 = sut.deserialize(row2) as SingleDeserializerOutput
    expect(result2.start).toEqual('500') // 1500 - 1000
    expect(result2.end).toEqual('800') // 500 + 300
  })
})

describe('CsvSegmentedDurationEyeDeserializer - Eye movement type classification', () => {
  test('Eye movement type 0 maps to Fixation', () => {
    const header = ['stimulus', 'participant', 'timestamp', 'duration', 'eyemovementtype', 'AOI']
    const sut = new CsvSegmentedDurationEyeDeserializer(header)
    const row = ['Stimulus', 'Participant', '100', '50', '0', 'Region']
    const result = sut.deserialize(row) as SingleDeserializerOutput
    
    expect(result.category).toEqual('Fixation')
  })

  test('Eye movement type 1 maps to Saccade', () => {
    const header = ['stimulus', 'participant', 'timestamp', 'duration', 'eyemovementtype', 'AOI']
    const sut = new CsvSegmentedDurationEyeDeserializer(header)
    const row = ['Stimulus', 'Participant', '100', '50', '1', 'Region']
    const result = sut.deserialize(row) as SingleDeserializerOutput
    
    expect(result.category).toEqual('Saccade')
  })

  test('Eye movement type 2 maps to Saccade (non-zero values)', () => {
    const header = ['stimulus', 'participant', 'timestamp', 'duration', 'eyemovementtype', 'AOI']
    const sut = new CsvSegmentedDurationEyeDeserializer(header)
    const row = ['Stimulus', 'Participant', '100', '50', '2', 'Region']
    const result = sut.deserialize(row) as SingleDeserializerOutput
    
    // Any non-zero value should be treated as Saccade
    expect(result.category).toEqual('Saccade')
  })
})

describe('CsvSegmentedDurationEyeDeserializer - Finalize', () => {
  test('Finalize returns null (no state to finalize)', () => {
    const header = ['stimulus', 'participant', 'timestamp', 'duration', 'eyemovementtype', 'AOI']
    const sut = new CsvSegmentedDurationEyeDeserializer(header)
    const row = ['Stimulus', 'Participant', '100', '50', '0', 'Region']
    
    // Process a row
    void sut.deserialize(row)
    
    // Finalize should return null since this deserializer doesn't maintain state
    const result = sut.finalize()
    expect(result).toBeNull()
  })

  test('Finalize can be called without processing any rows', () => {
    const header = ['stimulus', 'participant', 'timestamp', 'duration', 'eyemovementtype', 'AOI']
    const sut = new CsvSegmentedDurationEyeDeserializer(header)
    
    // Finalize without processing any rows should not throw
    expect(() => {
      const result = sut.finalize()
      expect(result).toBeNull()
    }).not.toThrow()
  })
})

