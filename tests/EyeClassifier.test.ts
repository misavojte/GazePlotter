/**
 * Vitest test for EyeClassifier
 *
 * @module EyeClassifier
 * @see $lib/class/Eye/EyeClassifier/EyeClassifier.ts
 */

import { EyeClassifier } from '$lib/class/Eye/EyeClassifier/EyeClassifier.ts'
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
})

// TODO: Add more tests and more complex ones :)
