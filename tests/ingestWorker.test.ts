/**
 * Worker ZIP failure paths — drives the REAL worker module (real job,
 * real Pupil Cloud format, real JSZip) with no mocks.
 *
 * The pre-refactor version of this file mocked `PupilCloudPipeline` to pin
 * its "completed without producing final data" error. That state is
 * structurally impossible in v2 (an IngestJob always produces a result or
 * throws once all sources are in), so the pins here are the v2 failure
 * surfaces a user can actually hit with a bad Pupil Cloud export.
 */

import JSZip from 'jszip'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  bootWorker,
  posted,
  resetWorkerGlobals,
  send,
} from './helpers/ingestServiceHarness'

const failMessage = () => {
  const fail = posted.find(p => p.message.type === 'fail')
  expect(fail).toBeDefined()
  expect(fail!.message.data).toBeInstanceOf(Error)
  return (fail!.message.data as Error).message
}

describe('ingest worker ZIP handling', () => {
  beforeEach(bootWorker)
  afterEach(resetWorkerGlobals)

  it("a zip missing the required Pupil Cloud CSVs posts a 'fail' with the pinned message", async () => {
    const zip = new JSZip()
    zip.file('readme.txt', 'not a pupil export')
    const buffer = await zip.generateAsync({ type: 'arraybuffer' })

    await send('file-names', ['broken.zip'])
    await send('file', new Blob([buffer]))

    expect(failMessage()).toBe('Missing sections.csv in ZIP')
    expect(posted.some(p => p.message.type === 'done')).toBe(false)
  })

  it("a structurally valid but empty Pupil Cloud export posts the generic no-stimuli 'fail'", async () => {
    const zip = new JSZip()
    zip.file('sections.csv', 'section id,recording id,recording name\n')
    zip.file(
      'aoi_fixations.csv',
      'aoi id,aoi name,section id,recording id,fixation id,fixation duration [ms]\n'
    )
    zip.file(
      'fixations.csv',
      'section id,recording id,fixation id,start timestamp [ns],end timestamp [ns]\n'
    )
    const buffer = await zip.generateAsync({ type: 'arraybuffer' })

    await send('file-names', ['empty.zip'])
    await send('file', new Blob([buffer]))

    expect(failMessage()).toBe(
      'Parsing unsuccessful: No stimuli found. Please check your data file.'
    )
  })

  it('reads the right CSV when aoi_fixations.csv is listed before fixations.csv', async () => {
    // Entry order is the zip tool's choice; a substring lookup used to take
    // aoi_fixations.csv for fixations.csv and import nothing.
    const zip = new JSZip()
    zip.file(
      'aoi_fixations.csv',
      'aoi id,aoi name,section id,recording id,fixation id,fixation duration [ms]\n' +
        '1,Face,s1,r1,1,200\n'
    )
    zip.file(
      'fixations.csv',
      'section id,recording id,fixation id,start timestamp [ns],end timestamp [ns]\n' +
        's1,r1,1,1000000000,1200000000\n' +
        's1,r1,2,1300000000,1500000000\n'
    )
    zip.file(
      'sections.csv',
      'section id,recording id,recording name\ns1,r1,T4a_AZ_ZP_2025-04-17_11:16:45\n'
    )
    const buffer = await zip.generateAsync({ type: 'arraybuffer' })

    await send('file-names', ['Scene_A.zip'])
    await send('file', new Blob([buffer]))

    const done = posted.find(p => p.message.type === 'done')
    expect(done).toBeDefined()
    const data = done!.message.result.data
    expect(data.stimuli.data).toEqual([['Scene_A']])
    expect(data.participants.data).toEqual([['T4a_AZ_ZP']])
    expect(data.aois.data[0].map((aoi: string[]) => aoi[0])).toEqual(['Face'])
    expect(data.segments.segmentBuffer.length / 5).toBe(2)
  })
})
