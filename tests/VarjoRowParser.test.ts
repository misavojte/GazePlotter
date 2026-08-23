/**
 * Vitest tests for VarjoRowParser
 *
 * @module VarjoRowParser
 * @see $lib/data/ingest/formats/lib/rows/VarjoRowParser.ts
 */

import { VarjoRowParser } from '$lib/data/ingest/formats/lib/rows/VarjoRowParser'
import { test, expect, describe } from 'vitest'
import { createAdapterHarness } from './helpers/ingestAdapterHarness'

/*
  constructor (header: string[], fileName: string) {
    super()
    this.cTime = this.getIndex(header, 'Time')
    this.cActorLabel = this.getIndex(header, 'Actor Label')
    this.mParticipant = fileName.split('.')[0]
  }
  */
const varjoMockData = `Time,Actor Label
2022:11:11:15:50:18:30,Region_1
2022:11:11:15:50:18:31,Region_1
2022:11:11:15:50:18:32,Region_1
2022:11:11:15:50:18:33,Region_2
2022:11:11:15:50:18:34,Region_3
2022:11:11:15:50:18:35,Region_4`

describe('VarjoRowParser', () => {
  const varjoRows = varjoMockData.split('\n')
  const header = varjoRows[0].split(',')
  const delim = ','
  const seg = { categoryId: 0, participant: 'VarjoXXX', stimulus: 'VarjoScene' }

  test('emits a segment per AOI run, flushed by the next AOI change', () => {
    const sut = new VarjoRowParser(header, 'VarjoXXX.csv', delim)
    const { outputs, processRows } = createAdapterHarness(sut)
    processRows(varjoRows.slice(1))
    // The open Region_4 run stays buffered until finalize.
    expect(outputs).toEqual([
      { ...seg, aoi: ['Region_1'], start: 0, end: 2 },
      { ...seg, aoi: ['Region_2'], start: 3, end: 3 },
      { ...seg, aoi: ['Region_3'], start: 4, end: 4 },
    ])
  })

  test('Finalize flushes the last open segment', () => {
    const sut = new VarjoRowParser(header, 'VarjoXXX.csv', delim)
    const { outputs, processRows } = createAdapterHarness(sut)
    processRows(varjoRows.slice(1), { finalize: true })
    expect(outputs).toHaveLength(4)
    expect(outputs[3]).toEqual({ ...seg, aoi: ['Region_4'], start: 5, end: 5 })
  })
})
