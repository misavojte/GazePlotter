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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Posted = { message: any; options?: { transfer?: unknown[] } }

let posted: Posted[]
let workerSelf: {
  postMessage: (message: unknown, options?: { transfer?: unknown[] }) => void
  onmessage: ((event: { data: unknown }) => Promise<void>) | null
}

async function bootWorker() {
  posted = []
  // Inherit from globalThis so transitive deps that environment-sniff via
  // `self` (jszip → setimmediate) still find node's scheduling primitives.
  workerSelf = Object.assign(Object.create(globalThis), {
    postMessage: (message: unknown, options?: { transfer?: unknown[] }) => {
      posted.push({ message, options })
    },
    onmessage: null,
  })
  vi.stubGlobal('self', workerSelf)
  vi.resetModules()
  await import('$lib/data/ingest/worker')
}

const send = (type: string, data?: unknown) =>
  workerSelf.onmessage!({ data: { type, data } })

const failMessage = () => {
  const fail = posted.find(p => p.message.type === 'fail')
  expect(fail).toBeDefined()
  expect(fail!.message.data).toBeInstanceOf(Error)
  return (fail!.message.data as Error).message
}

describe('ingest worker ZIP handling', () => {
  beforeEach(bootWorker)
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it("a zip missing the required Pupil Cloud CSVs posts a 'fail' with the pinned message", async () => {
    const zip = new JSZip()
    zip.file('readme.txt', 'not a pupil export')
    const buffer = await zip.generateAsync({ type: 'arraybuffer' })

    await send('file-names', ['broken.zip'])
    await send('zip-buffer', { buffer, zipName: 'broken.zip' })

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
    await send('zip-buffer', { buffer, zipName: 'empty.zip' })

    expect(failMessage()).toBe(
      'Parsing unsuccessful: No stimuli found. Please check your data file.'
    )
  })
})
