/**
 * CHARACTERIZATION TESTS — IngestService file routing.
 *
 * Phase 0 of the ingest v2 refactor. Pins how the main-thread service
 * decides WHERE each uploaded file goes today:
 *   - .xml / event-CSV files are separated from eye-tracking files,
 *   - a leading .json file short-circuits to the workspace path and the
 *     remaining files are silently ignored (first-file-wins),
 *   - event-only uploads with no CSV event file fail with a specific message,
 *   - standalone CSV event files build an event-only dataset,
 *   - a worker 'done' message becomes a version-4 ParsedData envelope.
 *
 * The v2 IngestJob must reproduce these outcomes (the first-file-wins JSON
 * rule becomes an explicit workspace-precedence rule with the same result).
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

  it('first-file-wins: a leading .json routes to the workspace path and other files are ignored', async () => {
    const { service, report, posted } = loadHarness()
    // Plain '{}' is valid JSON but not a Tobii event file, so it stays an
    // "eye file"; the service then sees extension json on the FIRST file and
    // takes the workspace path. The csv is never dispatched anywhere.
    const json = fakeFile('workspace.json', '{}')
    const csv = fakeFile('data.csv', gazeCsv)

    const result = await service.loadFiles(createFileList([json, csv]))

    expect(result).toBe(false)
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        userMessage: expect.stringMatching(/^Could not process the file: /),
      })
    )
    // No worker traffic at all — csv silently ignored.
    expect(posted).toEqual([])
    expect(csv.stream).not.toHaveBeenCalled()
    expect(csv.arrayBuffer).not.toHaveBeenCalled()
    expect(service.status).toBe('error')
  })

  it('event-only upload without CSV event files fails with the pinned message', async () => {
    const { service, report } = loadHarness()
    const xml = fakeFile('events.xml', '<KeyFrames></KeyFrames>')

    const result = await service.loadFiles(createFileList([xml]))

    expect(result).toBe(false)
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        userMessage:
          'Only event files were uploaded. XML and JSON event files require eye-tracking data. Use custom CSV event files for standalone upload.',
      })
    )
    expect(service.status).toBe('error')
  })

  it('standalone CSV event file builds an event-only dataset without the worker', async () => {
    const { service, deps, posted } = loadHarness()
    const csv = fakeFile('events.csv', eventCsv)

    const result = await service.loadFiles(createFileList([csv]))

    expect(result).toBe(true)
    expect(posted).toEqual([]) // never went near the worker
    expect(service.status).toBe('ready')
    expect(deps.toastState.addSuccess).toHaveBeenCalledWith(
      expect.stringMatching(/^Event data loaded: events\.csv/)
    )

    const data = deps.engine.loadDataset.mock.calls[0][0]
    expect({
      capabilities: data.capabilities,
      stimuli: data.stimuli.data,
      participants: data.participants.data,
      eventChannels: data.eventData.data,
      eventBuffers: data.eventData.events,
    }).toMatchInlineSnapshot(`
      {
        "capabilities": {
          "event": true,
          "segmented": false,
          "spatial": false,
        },
        "eventBuffers": [
          [
            [
              [
                100,
                50,
              ],
              [
                200,
                0,
              ],
            ],
          ],
        ],
        "eventChannels": [
          [
            [
              "Blink",
              "Blink",
              "#888888",
            ],
          ],
        ],
        "participants": [
          [
            "P1",
            "P1",
          ],
          [
            "P2",
            "P2",
          ],
        ],
        "stimuli": [
          [
            "Stim1",
            "Stim1",
          ],
        ],
      }
    `)
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
      data: { type: 'done', data: sentinelData, classified },
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
