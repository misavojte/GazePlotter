/**
 * CHARACTERIZATION TESTS — IngestService file routing.
 *
 * Phase 0 of the ingest v2 refactor. Pins how the main-thread service
 * decides WHERE each uploaded file goes:
 *   - .xml / event-CSV files are separated from eye-tracking files,
 *   - everything else (workspace JSON included, since Phase 4) is dispatched
 *     to the worker; the first-file-wins JSON rule became the explicit
 *     workspace-precedence policy inside IngestJob (pinned at the worker
 *     protocol level in ingestCharacterization.protocol.test.ts),
 *   - event-only uploads (any format, CSV included) fail fast: event files
 *     annotate eye-tracking data and have no standalone visualisation,
 *   - a worker 'done' IngestResult envelope becomes a version-4 ParsedData
 *     envelope.
 *
 * User-facing outcomes (toasts, error envelopes, metadata) are unchanged
 * from the Phase 0 pins.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { IngestService } from '$lib/data/ingest/service.svelte'

type PostedMessage = { type: string; data?: unknown }

function createFileList(files: unknown[]): FileList {
  return Object.assign(files, {
    item: (index: number) => files[index] ?? null,
  }) as unknown as FileList
}

/** Minimal File stand-in covering every member the service touches. */
function fakeFile(name: string, content: string) {
  const bytes = new TextEncoder().encode(content)
  return {
    name,
    size: bytes.byteLength,
    text: vi.fn(async () => content),
    slice: (start: number, end: number) => ({
      text: async () => content.slice(start, end),
    }),
    stream: vi.fn(
      () =>
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(bytes)
            controller.close()
          },
        })
    ),
    arrayBuffer: vi.fn(async () => bytes.buffer),
  }
}

class FakeFileReader {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  result: string | null = null
  readAsText(file: { text(): Promise<string> }) {
    void file.text().then(
      t => {
        this.result = t
        this.onload?.()
      },
      () => this.onerror?.()
    )
  }
}

function loadHarness() {
  const posted: PostedMessage[] = []
  const workerInstances: FakeWorker[] = []

  class FakeWorker {
    onmessage: ((event: { data: unknown }) => void) | null = null
    onerror: ((event: unknown) => void) | null = null
    onmessageerror: ((event: unknown) => void) | null = null
    postMessage = vi.fn((message: PostedMessage) => {
      posted.push(message)
    })
    terminate = vi.fn()

    constructor(_url: URL, _options: { type: string }) {
      workerInstances.push(this)
    }
  }

  vi.stubGlobal('Worker', FakeWorker as unknown as typeof Worker)
  vi.stubGlobal('FileReader', FakeFileReader as unknown as typeof FileReader)
  vi.stubGlobal('navigator', { userAgent: 'vitest' })

  const report = vi.fn((input: { userMessage: string; cause: unknown }) => ({
    id: 1,
    createdAt: '2026-06-10T00:00:00.000Z',
    origin: 'ingest',
    severity: 'fatal-load',
    userMessage: input.userMessage,
    debugMessage:
      input.cause instanceof Error ? input.cause.message : String(input.cause),
    stack: undefined,
  }))

  const deps = {
    engine: { loadDataset: vi.fn(), metadata: null },
    errorService: { clearAll: vi.fn(), clearFatalLoad: vi.fn(), report },
    grid: { reset: vi.fn() },
    modalState: { open: vi.fn(), close: vi.fn() },
    toastState: {
      addInfo: vi.fn(),
      addSuccess: vi.fn(),
      addWarning: vi.fn(),
    },
    resetWorkspaceHistory: vi.fn(),
  }

  return {
    service: new IngestService(deps as never),
    deps,
    report,
    posted,
    workerInstances,
  }
}

const gazeCsv = `Time,Participant,Stimulus,AOI
0,P1,Map_A,Region_1
1,P1,Map_A,Region_1`

const eventCsv = `stimulus,participant,eventName,start,duration
Stim1,P1,Blink,100,50
Stim1,P2,Blink,200,0`

describe('IngestService routing', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('separates .xml event files: only eye-tracking files reach the worker', async () => {
    const { service, posted } = loadHarness()
    const csv = fakeFile('data.csv', gazeCsv)
    const xml = fakeFile('events.xml', '<KeyFrames></KeyFrames>')

    void service.loadFiles(createFileList([csv, xml]))

    await vi.waitFor(() => {
      expect(posted.some(m => m.type === 'file-names')).toBe(true)
    })
    const fileNames = posted.find(m => m.type === 'file-names')
    expect(fileNames?.data).toEqual(['data.csv'])
  })

  it('first-file-wins: a leading .json upload streams to the worker; a worker fail surfaces as the pinned error', async () => {
    // Phase 4 moved workspace JSON parsing into the worker: the service now
    // streams EVERY file (json included) and the first-file-wins rule lives
    // in IngestJob as the explicit workspace-precedence policy (pinned at
    // the worker protocol level). What the service still owns — and what
    // this test pins — is dispatch (all files reach the worker) and the
    // unchanged user-facing failure envelope.
    const { service, report, posted, workerInstances } = loadHarness()
    const json = fakeFile('workspace.json', '{}')
    const csv = fakeFile('data.csv', gazeCsv)

    const resultPromise = service.loadFiles(createFileList([json, csv]))

    await vi.waitFor(() => {
      expect(posted.filter(m => m.type === 'stream').length).toBe(2)
    })
    const fileNames = posted.find(m => m.type === 'file-names')
    expect(fileNames?.data).toEqual(['workspace.json', 'data.csv'])

    // The real worker rejects '{}' (not a valid workspace); simulate it.
    workerInstances[0].onmessage?.({
      data: { type: 'fail', data: new Error('Invalid workspace file') },
    })

    await expect(resultPromise).resolves.toBe(false)
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        userMessage: expect.stringMatching(/^Could not process the file: /),
      })
    )
    expect(service.status).toBe('error')
  })

  it('event-only XML upload fails fast with the pinned message', async () => {
    const { service, report, posted } = loadHarness()
    const xml = fakeFile('events.xml', '<KeyFrames></KeyFrames>')

    const result = await service.loadFiles(createFileList([xml]))

    expect(result).toBe(false)
    expect(posted).toEqual([]) // never went near the worker
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        userMessage:
          'Only event files were uploaded. Event files annotate eye-tracking data and must be uploaded together with it.',
      })
    )
    expect(service.status).toBe('error')
  })

  it('event-only CSV upload fails fast (no standalone event-only dataset)', async () => {
    const { service, report, deps, posted } = loadHarness()
    const csv = fakeFile('events.csv', eventCsv)

    const result = await service.loadFiles(createFileList([csv]))

    expect(result).toBe(false)
    expect(posted).toEqual([]) // never went near the worker
    expect(deps.engine.loadDataset).not.toHaveBeenCalled() // no dataset built
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        userMessage:
          'Only event files were uploaded. Event files annotate eye-tracking data and must be uploaded together with it.',
      })
    )
    expect(service.status).toBe('error')
  })

  it("a worker 'done' message becomes a version-4 success envelope", async () => {
    const { service, deps, posted, workerInstances } = loadHarness()
    const csv = fakeFile('data.csv', gazeCsv)

    const resultPromise = service.loadFiles(createFileList([csv]))

    await vi.waitFor(() => {
      expect(posted.some(m => m.type === 'stream')).toBe(true)
    })

    const sentinelData = { sentinel: true }
    const classified = {
      type: 'csv',
      rowDelimiter: '\n',
      columnDelimiter: ',',
      encoding: 'utf-8',
      userInputSetting: '',
      headerRowId: 0,
    }
    workerInstances[0].onmessage?.({
      data: {
        type: 'done',
        result: { kind: 'dataset', data: sentinelData, settings: classified },
      },
    })

    await expect(resultPromise).resolves.toBe(true)
    expect(service.status).toBe('ready')
    expect(deps.engine.loadDataset).toHaveBeenCalledWith(sentinelData)
    expect(deps.toastState.addSuccess).toHaveBeenCalledWith(
      expect.stringMatching(/^data\.csv .* parsed successfully in /)
    )
    expect(service.metadata).toEqual(
      expect.objectContaining({
        status: 'success',
        fileNames: ['data.csv'],
        parseSettings: classified,
        gazePlotterVersion: expect.any(String),
        clientUserAgent: 'vitest',
      })
    )
    // Grid resets to the default layout (not empty).
    const gridArg = deps.grid.reset.mock.calls.at(-1)?.[0]
    expect(Array.isArray(gridArg)).toBe(true)
    expect(gridArg.length).toBeGreaterThan(0)
    expect(workerInstances[0].terminate).toHaveBeenCalledTimes(1)
  })
})
