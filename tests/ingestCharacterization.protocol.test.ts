/**
 * CHARACTERIZATION TESTS — worker message protocol.
 *
 * Phase 0 of the ingest v2 refactor. Drives the REAL worker module (real
 * pipeline, real classifier, real writer — nothing mocked) through its
 * postMessage protocol and pins:
 *   - the inbound message types it accepts ('file-names', 'buffer', 'stream',
 *     'zip-buffer', 'user-input'),
 *   - the outbound sequence (progress* → done) and payload shape,
 *   - binary buffers are TRANSFERRED (not copied) on 'done',
 *   - the 'request-user-input' round trip for tobii-with-event,
 *   - routing-by-extension to the Pupil Cloud zip pipeline,
 *   - failures surface as a 'fail' message carrying the original Error.
 *
 * Phase 4 of the refactor intentionally replaces 'request-user-input' with a
 * generic 'prompt' message — when that lands, THIS file is updated in the
 * same commit. Until then, this is the contract.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { testMobileTsvData } from './TobiiAdapter.test.data'

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

const toBuffer = (s: string) => new TextEncoder().encode(s).buffer

const csvContent = `Time,Participant,Stimulus,AOI
0,P1,Map_A,Region_1
1,P1,Map_A,Region_1
2,P1,Map_A,Region_2`

describe('worker protocol', () => {
  beforeEach(bootWorker)
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it("csv buffer: emits progress then 'done' with data + classified, transferring binary buffers", async () => {
    await send('file-names', ['data.csv'])
    expect(posted).toEqual([]) // file-names is acknowledged silently

    await send('buffer', toBuffer(csvContent))

    const types = posted.map(p => p.message.type)
    expect(types[types.length - 1]).toBe('done')
    expect(types.slice(0, -1).every(t => t === 'progress')).toBe(true)
    expect(types.filter(t => t === 'progress').length).toBeGreaterThan(0)

    const done = posted[posted.length - 1]
    expect(done.message.classified).toEqual({
      type: 'csv',
      rowDelimiter: '\n',
      columnDelimiter: ',',
      encoding: 'utf-8',
      userInputSetting: '',
      headerRowId: 0,
    })
    expect(done.message.data.stimuli.data).toEqual([['Map_A']])
    expect(done.message.data.participants.data).toEqual([['P1']])

    // The three binary buffers ride the transfer list (zero-copy contract).
    expect(done.options?.transfer).toHaveLength(3)
    expect(done.options?.transfer).toContain(
      done.message.data.segments.segmentBuffer.buffer
    )
    expect(done.options?.transfer).toContain(
      done.message.data.segments.indexTable.buffer
    )
    expect(done.options?.transfer).toContain(
      done.message.data.segments.aoiPool.buffer
    )
  })

  it("tobii-with-event: 'request-user-input' round trip completes with the user's setting", async () => {
    await send('file-names', ['tobii.tsv'])

    const processing = send('buffer', toBuffer(testMobileTsvData))

    await vi.waitFor(() => {
      expect(
        posted.some(p => p.message.type === 'request-user-input')
      ).toBe(true)
    })
    // Worker is now suspended awaiting the answer; deliver it.
    await send('user-input', 'IntervalStart;IntervalEnd')
    await processing

    const done = posted.find(p => p.message.type === 'done')
    expect(done).toBeDefined()
    expect(done!.message.classified.type).toBe('tobii-with-event')
    expect(done!.message.classified.userInputSetting).toBe(
      'IntervalStart;IntervalEnd'
    )
    expect(done!.message.data.stimuli.data).toEqual([['geostul_snap']])
  })

  it("unclassifiable content surfaces as a 'fail' message with the original error", async () => {
    await send('file-names', ['mystery.bin'])
    await send('buffer', toBuffer('hello world\nfoo bar'))

    const fail = posted.find(p => p.message.type === 'fail')
    expect(fail).toBeDefined()
    expect(fail!.message.data).toBeInstanceOf(Error)
    expect((fail!.message.data as Error).message).toBe('Unknown file type')
  })

  it(".zip file names route to the Pupil Cloud pipeline (extension-based fork) and bad zips 'fail'", async () => {
    await send('file-names', ['recording.zip'])
    await send('zip-buffer', {
      buffer: toBuffer('this is not a zip archive'),
      zipName: 'recording.zip',
    })

    const fail = posted.find(p => p.message.type === 'fail')
    expect(fail).toBeDefined()
    expect(fail!.message.data).toBeInstanceOf(Error)
  })

  it("unknown inbound message types surface as a 'fail'", async () => {
    await send('file-names', ['data.csv'])
    await send('nonsense-type', {})

    const fail = posted.find(p => p.message.type === 'fail')
    expect(fail).toBeDefined()
  })
})
