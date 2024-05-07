/**
 * Vitest tests for aoiVisibilityServices
 *
 * We cannot test DOMParser in the browser environment, so we won't
 * be able to test the SMI XML processing function. We can test the
 * Tobii JSON processing function, however.
 *
 * @module services/aoiVisibilityServices
 * @see src/lib/services/aoiVisibilityServices.ts
 */
import {
  processTobii,
  isTobiiJson,
  processTobiiKeyFrames,
} from '$lib/services/aoiVisibilityServices.ts'
import { expect, test } from 'vitest'

test('Input Tobii JSON validation - False inputs', () => {
  expect(isTobiiJson({})).toBe(false)
  expect(isTobiiJson({ Aois: [] })).toBe(false)
  expect(isTobiiJson({ Aois: {} })).toBe(false)
  expect(isTobiiJson({ Aois: { 0: {} } })).toBe(false)
  expect(isTobiiJson({ Aois: { 0: { KeyFrames: {} } } })).toBe(false)
})

const validTobiiJson = {
  Tags: [],
  Media: {
    MediaType: 0,
    Height: 0,
    Width: 0,
    MediaCount: 0,
    DurationMicroseconds: 0,
  },
  Version: 0,
  Aois: {
    0: {
      Red: 0,
      Green: 0,
      Blue: 0,
      Name: 'a',
      Tags: [],
      KeyFrames: {
        0: {
          IsActive: false,
          Seconds: 0,
          Vertices: [],
        },
        1: {
          IsActive: true,
          Seconds: 1,
          Vertices: [],
        },
        2: {
          IsActive: false,
          Seconds: 5,
          Vertices: [],
        },
      },
    },
  },
}

const seeminglyValidTobiiJson = {
  Tags: [],
  Media: {
    MediaType: 0,
    Height: 0,
    Width: 0,
    MediaCount: 0,
    DurationMicroseconds: 0,
  },
  Version: 0,
  Aois: {
    0: {
      Red: 0,
      Green: 0,
      Blue: 0,
      Name: 'a',
      Tags: [],
      KeyFrames: {
        0: {
          IsActive: true,
          Seconds: 0,
          Vertices: [],
        },
        1: {
          IsActive: false,
          Seconds: 1,
          Vertices: [],
        },
        2: {
          IsActive: true,
          Seconds: 5,
          Vertices: [],
        },
      },
    },
  },
}

test('Input Tobii JSON validation - True inputs', () => {
  expect(isTobiiJson(validTobiiJson)).toBe(true)
})

test('Process Tobii JSON - KeyFrames - Correct data', () => {
  const result = processTobiiKeyFrames(validTobiiJson.Aois[0].KeyFrames)
  expect(result.length).toBe(2)
  expect(result).toEqual([1000, 5000]) // 1s, 5s (in ms! there is a conversion)
})

test('Process Tobii JSON - KeyFrames - Throw on unclosed interval', () => {
  //expect to throw, because the last keyframe is not false (not even number of keyframes)
  expect(() =>
    processTobiiKeyFrames(seeminglyValidTobiiJson.Aois[0].KeyFrames)
  ).toThrow()
})

test('Process Tobii JSON - Whole - Correct data', () => {
  const result = processTobii(0, 0, validTobiiJson)
  expect(result.multipleAoiVisibilityArrays).toEqual(
    [[1000, 5000]] // 1s, 5s (in ms! there is a conversion)
  )
  expect(result.multipleAoiNames).toEqual(['a'])
  expect(result.participantId).toEqual(0)
  expect(result.stimulusId).toEqual(0)
})
