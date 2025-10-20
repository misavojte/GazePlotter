/**
 * Vitest test for EyeClassifier
 *
 * @module EyeClassifier
 * @see $lib/gaze-data/back-process/class/EyeClassifier/EyeClassifier.ts
 */

import { EyeClassifier } from '$lib/gaze-data/back-process/class/EyeClassifier/EyeClassifier'
import { test, expect, describe } from 'vitest'

const mockBeGazeData = `Event Start Trial Time [ms],Event End Trial Time [ms],Stimulus,Participant,Category,AOI Name
0,100,Map_A,Participant_1,Fixation,Region_1`

const mockGazePointData = `MEDIA_ID,MEDIA_NAME,TIME(2021/07/13 09:21:09.801),FPOGS,FPOGD,FPOGID,BKID,BKDUR,AOI
0,Slide0,0.06689,0.00000,0.06689,1,0,0.00000,,`

const mockOgamaData = `# Contents: Similarity Measurements of scanpaths.
#
#
#
#
#
Sequence Similarity,Scanpath string
Participant_1,ABCD`

// Mock CSV data with proper line endings (\r\n)
const mockCsvData = 'Time,Participant,Stimulus,AOI\r\n0,Participant_1,Map_A,Region_1\r\n1,Participant_1,Map_A,Region_1'

const mockCsvSegmentedData = 'From,To,Participant,Stimulus,AOI\r\n0,1,Participant_1,Map_A,Region_1\r\n1,2,Participant_1,Map_A,Region_1'

const mockCsvSegmentedDurationData = 'stimulus,participant,timestamp,duration,eyemovementtype,AOI\r\nSMI Base,Anna,226.2,72,1,\r\nSMI Base,Anna,298.2,120,0,Map'

describe('EyeClassifier', () => {
  test('Constructor', () => {
    const sut = new EyeClassifier()
    expect(sut).toBeDefined()
  })

  test('Classify BeGaze', () => {
    const sut = new EyeClassifier()
    const result = sut.classify(mockBeGazeData)
    expect(result).toEqual({
      type: 'begaze',
      rowDelimiter: '\r\n',
      columnDelimiter: '\t',
      userInputSetting: '',
      headerRowId: 0,
    })
  })

  test('Classify GazePoint', () => {
    const sut = new EyeClassifier()
    const result = sut.classify(mockGazePointData)
    expect(result).toEqual({
      type: 'gazepoint',
      rowDelimiter: '\r\n',
      columnDelimiter: ',',
      userInputSetting: '',
      headerRowId: 0,
    })
  })

  test('Classify Ogama', () => {
    const sut = new EyeClassifier()
    const result = sut.classify(mockOgamaData)
    expect(result).toEqual({
      type: 'ogama',
      rowDelimiter: '\r\n',
      columnDelimiter: '\t',
      userInputSetting: '',
      headerRowId: 8,
    })
  })

  test('Classify CSV (continuous time series)', () => {
    const sut = new EyeClassifier()
    const result = sut.classify(mockCsvData)
    expect(result).toEqual({
      type: 'csv',
      rowDelimiter: '\r\n',
      columnDelimiter: ',',
      userInputSetting: '',
      headerRowId: 0,
    })
  })

  test('Classify CSV Segmented (From/To columns)', () => {
    const sut = new EyeClassifier()
    const result = sut.classify(mockCsvSegmentedData)
    expect(result).toEqual({
      type: 'csv-segmented',
      rowDelimiter: '\r\n',
      columnDelimiter: ',',
      userInputSetting: '',
      headerRowId: 0,
    })
  })

  test('Classify CSV Segmented Duration (timestamp + duration)', () => {
    const sut = new EyeClassifier()
    const result = sut.classify(mockCsvSegmentedDurationData)
    expect(result).toEqual({
      type: 'csv-segmented-duration',
      rowDelimiter: '\r\n',
      columnDelimiter: ',',
      userInputSetting: '',
      headerRowId: 0,
    })
  })
})

describe('EyeClassifier - Type detection methods', () => {
  test('isCsvSegmentedDuration detects duration-based format', () => {
    const sut = new EyeClassifier()
    expect(sut.isCsvSegmentedDuration(mockCsvSegmentedDurationData)).toBe(true)
  })

  test('isCsvSegmentedDuration rejects regular CSV', () => {
    const sut = new EyeClassifier()
    expect(sut.isCsvSegmentedDuration(mockCsvData)).toBe(false)
  })

  test('isCsvSegmentedDuration rejects From/To segmented CSV', () => {
    const sut = new EyeClassifier()
    expect(sut.isCsvSegmentedDuration(mockCsvSegmentedData)).toBe(false)
  })

  test('isCsvSegmented detects From/To format', () => {
    const sut = new EyeClassifier()
    expect(sut.isCsvSegmented(mockCsvSegmentedData)).toBe(true)
  })

  test('isCsvSegmented rejects duration-based format', () => {
    const sut = new EyeClassifier()
    expect(sut.isCsvSegmented(mockCsvSegmentedDurationData)).toBe(false)
  })

  test('isCsv detects continuous time series format', () => {
    const sut = new EyeClassifier()
    expect(sut.isCsv(mockCsvData)).toBe(true)
  })

  test('getTypeFromSlice prioritizes more specific formats', () => {
    const sut = new EyeClassifier()
    // Duration-based should be detected before regular segmented
    expect(sut.getTypeFromSlice(mockCsvSegmentedDurationData)).toBe('csv-segmented-duration')
    // Segmented should be detected before regular CSV
    expect(sut.getTypeFromSlice(mockCsvSegmentedData)).toBe('csv-segmented')
    // Regular CSV is detected last
    expect(sut.getTypeFromSlice(mockCsvData)).toBe('csv')
  })
})
