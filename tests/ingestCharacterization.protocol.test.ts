/**
 * CHARACTERIZATION TESTS — worker message protocol.
 *
 * Phase 0 of the ingest v2 refactor. Drives the REAL worker module (real
 * job, real registry, real writer — nothing mocked) through its postMessage
 * protocol and pins:
 *   - the inbound message types it accepts ('file-names', 'buffer', 'stream',
 *     'zip-buffer', 'prompt-response'),
 *   - the outbound sequence (progress* → done) and payload shape
 *     ('done' carries an IngestResult envelope),
 *   - binary buffers are TRANSFERRED (not copied) on 'done',
 *   - the 'prompt' round trip for tobii-with-event,
 *   - routing-by-extension to the Pupil Cloud zip format,
 *   - failures surface as a 'fail' message carrying the original Error.
 *
 * Phase 4 of the refactor intentionally replaced 'request-user-input' with
 * the generic 'prompt' message and the {data, classified} done payload with
 * the IngestResult envelope; the pins below changed in that same commit.
 * Everything pinned through the envelope (settings values, dataset digests,
 * error strings, transfer list) is unchanged from the Phase 0 originals.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { testMobileTsvData } from './TobiiRowParser.test.data'

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

  it("csv buffer: emits progress then 'done' with an IngestResult envelope, transferring binary buffers", async () => {
    await send('file-names', ['data.csv'])
    expect(posted).toEqual([]) // file-names is acknowledged silently

    await send('buffer', toBuffer(csvContent))

    const types = posted.map(p => p.message.type)
    expect(types[types.length - 1]).toBe('done')
    expect(types.slice(0, -1).every(t => t === 'progress')).toBe(true)
    expect(types.filter(t => t === 'progress').length).toBeGreaterThan(0)

    const done = posted[posted.length - 1]
    expect(done.message.result.kind).toBe('dataset')
    expect(done.message.result.settings).toEqual({
      type: 'csv',
      rowDelimiter: '\n',
      columnDelimiter: ',',
      encoding: 'utf-8',
      userInputSetting: '',
      headerRowId: 0,
    })
    expect(done.message.result.data.stimuli.data).toEqual([['Map_A']])
    expect(done.message.result.data.participants.data).toEqual([['P1']])

    // The three binary buffers ride the transfer list (zero-copy contract).
    expect(done.options?.transfer).toHaveLength(3)
    expect(done.options?.transfer).toContain(
      done.message.result.data.segments.segmentBuffer.buffer
    )
    expect(done.options?.transfer).toContain(
      done.message.result.data.segments.indexTable.buffer
    )
    expect(done.options?.transfer).toContain(
      done.message.result.data.segments.aoiPool.buffer
    )
  })

  it("tobii-with-event: 'prompt' round trip completes with the user's setting", async () => {
    await send('file-names', ['tobii.tsv'])

    const processing = send('buffer', toBuffer(testMobileTsvData))

    await vi.waitFor(() => {
      expect(posted.some(p => p.message.type === 'prompt')).toBe(true)
    })
    const prompt = posted.find(p => p.message.type === 'prompt')
    expect(prompt!.message.promptId).toBe('tobii-parsing-input')
    // Worker is now suspended awaiting the answer; deliver it.
    await send('prompt-response', '{"stimulusStartSuffix":"IntervalStart","stimulusEndSuffix":"IntervalEnd"}')
    await processing

    const done = posted.find(p => p.message.type === 'done')
    expect(done).toBeDefined()
    expect(done!.message.result.settings.type).toBe('tobii-with-event')
    expect(done!.message.result.settings.userInputSetting).toBe(
      '{"stimulusStartSuffix":"IntervalStart","stimulusEndSuffix":"IntervalEnd"}'
    )
    expect(done!.message.result.data.stimuli.data).toEqual([['geostul_snap']])
  })

  it("unclassifiable content surfaces as a 'fail' message with the original error", async () => {
    await send('file-names', ['mystery.bin'])
    await send('buffer', toBuffer('hello world\nfoo bar'))

    const fail = posted.find(p => p.message.type === 'fail')
    expect(fail).toBeDefined()
    expect(fail!.message.data).toBeInstanceOf(Error)
    expect((fail!.message.data as Error).message).toBe('Unknown file type')
  })

  it('WORKSPACE PRECEDENCE: a leading .json claims the job; the other sources are never parsed', async () => {
    // The historical first-file-wins JSON rule, now an explicit policy in
    // IngestJob. '{}' is routed to the workspace format BY FILE NAME (it
    // fails there as an invalid workspace) — content detection never runs,
    // and the perfectly valid csv that follows is never parsed. If the
    // precedence rule broke, this upload would either produce 'done' (csv
    // parsed) or fail with 'Unknown file type' (json content-detected).
    await send('file-names', ['workspace.json', 'data.csv'])
    await send('buffer', toBuffer('{}'))
    await send('buffer', toBuffer(csvContent))

    expect(posted.some(p => p.message.type === 'done')).toBe(false)
    const fail = posted.find(p => p.message.type === 'fail')
    expect(fail).toBeDefined()
    expect(fail!.message.data).toBeInstanceOf(Error)
    expect((fail!.message.data as Error).message).not.toBe('Unknown file type')
  })

  it(".zip file names route to the Pupil Cloud format (file-name claim) and bad zips 'fail'", async () => {
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
