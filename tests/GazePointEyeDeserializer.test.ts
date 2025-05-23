/**
 * Vitest tests for GazePointEyeDeserializer
 *
 * @module GazePointEyeDeserializer
 * @see src/lib/class/Eye/EyeDeserializer/GazePointEyeDeserializer.ts
 */

import { test, expect, describe } from 'vitest'
import { GazePointEyeDeserializer } from '$lib/class/Eye/EyeDeserializer/GazePointEyeDeserializer'

const separator = ','
const header =
  'MEDIA_ID,MEDIA_NAME,TIME(2021/07/13 09:21:09.801),FPOGS,FPOGD,FPOGID,BKID,BKDUR,AOI,'.split(
    separator
  )

const fixRow1 = '0,Slide0,0.06689,0.00000,0.06689,1,0,0.00000,,'.split(
  separator
)
const fixRow2 = '0,Slide0,0.13378,0.06689,0.06689,2,0,0.00000,,'.split(
  separator
)

const rawRow1 =
  '2,Slide01,1.52063,1.38635,0.13428,6,0,0.00000,Right-AOI 4,'.split(separator)
const rawRow2 =
  '2,Slide01,1.54968,1.38635,0.16333,6,0,0.00000,Right-AOI 4,'.split(separator)
const rawRow3 = '2,Slide01,1.57410,1.38635,0.16333,6,157,0.00000,,'.split(
  separator
)
const rawRow4 = '2,Slide01,1.71008,1.38635,0.16333,6,0,0.13605,,'.split(
  separator
) // with blink dur info
const rawRow5 =
  '2,Slide01,1.74805,1.72827,0.01978,7,0,0.00000,Right-AOI 4,'.split(separator)
const rawRow6 =
  '2,Slide01,1.91528,1.72827,0.18701,7,0,0.00000,Right-AOI 4,'.split(separator)
const rawRow7 = '2,Slide01,1.92200,1.72827,0.18701,7,0,0.00000,,'.split(
  separator
)
const rawRow8 = '2,Slide01,1.93200,1.72827,0.18701,7,0,0.00000,,'.split(
  separator
)
const rawRow9 = '2,Slide01,1.94200,1.93200,0.10000,8,0,0.00000,,'.split(
  separator
)

describe('GazePoint Reducer', () => {
  test('Construct Reducer', () => {
    const reducer = new GazePointEyeDeserializer(header, 'P1')
    expect(reducer).toBeInstanceOf(GazePointEyeDeserializer)
  })
  test('Reduce Fixation', () => {
    const reducer = new GazePointEyeDeserializer(header, 'P1')
    const result = reducer.deserialize(fixRow1)
    expect(result).toBe(null)
    const result2 = reducer.deserialize(fixRow2)
    expect(result2?.aoi).toBe(null)
    expect(result2?.category).toBe('Fixation')
    expect(result2?.end).toBe('0.06689')
    expect(result2?.participant).toBe('P1')
    expect(result2?.start).toBe('0')
    expect(result2?.stimulus).toBe('Slide0')
    const result3 = reducer.finalize()
    expect(result3?.aoi).toBe(null)
    expect(result3?.category).toBe('Fixation')
    expect(result3?.end).toBe('0.13378')
    expect(result3?.participant).toBe('P1')
    expect(result3?.start).toBe('0.06689')
    expect(result3?.stimulus).toBe('Slide0')
  })
  test('Reduce Raw', () => {
    const reducer = new GazePointEyeDeserializer(header, 'P1')
    expect(reducer.deserialize(rawRow1)).toBe(null)
    expect(reducer.deserialize(rawRow2)).toBe(null)
    const result1 = reducer.deserialize(rawRow3)
    expect(result1?.aoi?.[0]).toBe('Right-AOI 4')
    expect(result1?.category).toBe('Fixation')
    expect(result1?.end).toBe('1.54968')
    expect(result1?.participant).toBe('P1')
    expect(result1?.start).toBe('1.38635')
    expect(reducer.deserialize(rawRow4)).toBe(null)
    const blinkResult = reducer.deserialize(rawRow5)
    expect(blinkResult?.aoi).toBe(null)
    expect(blinkResult?.start).toBe('1.5741')
    expect(blinkResult?.category).toBe('Blink')
    expect(blinkResult?.end).toBe('1.71008')
    expect(reducer.deserialize(rawRow6)).toBe(null)
    const result2 = reducer.deserialize(rawRow7)
    expect(result2?.aoi?.[0]).toBe('Right-AOI 4')
    expect(result2?.category).toBe('Fixation')
    expect(result2?.end).toBe('1.91528')
    expect(reducer.deserialize(rawRow8)).toBe(null)
    expect(reducer.deserialize(rawRow9)).toBe(null)
  })
})
