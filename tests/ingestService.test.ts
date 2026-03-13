import { afterEach, describe, expect, it, vi } from 'vitest'

type WorkerPostMessage = (message: {
  type: string
  data?: unknown
}) => void

function createFileList(files: any[]): FileList {
  return Object.assign(files, {
    item: (index: number) => files[index] ?? null,
  }) as unknown as FileList
}

function createErrorRecord(input: {
  origin: string
  severity: string
  userMessage: string
  cause: unknown
  context?: Record<string, unknown>
}) {
  return {
    id: 1,
    createdAt: '2026-03-13T00:00:00.000Z',
    origin: input.origin,
    severity: input.severity,
    userMessage: input.userMessage,
    debugMessage:
      input.cause instanceof Error ? input.cause.message : String(input.cause),
    stack: input.cause instanceof Error ? input.cause.stack : undefined,
    context: input.context,
  }
}

async function loadHarness(workerPostMessage: WorkerPostMessage) {
  vi.resetModules()

  const workerInstances: Array<{
    terminate: ReturnType<typeof vi.fn>
  }> = []

  class FakeWorker {
    onmessage: ((event: MessageEvent) => void) | null = null
    onerror: ((event: ErrorEvent) => void) | null = null
    onmessageerror: ((event: MessageEvent) => void) | null = null
    postMessage = vi.fn((message: { type: string; data?: unknown }) =>
      workerPostMessage(message)
    )
    terminate = vi.fn()

    constructor(_url: URL, _options: { type: string }) {
      workerInstances.push({ terminate: this.terminate })
    }
  }

  vi.stubGlobal('Worker', FakeWorker as unknown as typeof Worker)
  vi.stubGlobal('navigator', { userAgent: 'vitest' })

  const { IngestService } = await import('$lib/data/ingest/service.svelte')

  const report = vi.fn((input: any) => createErrorRecord(input))
  const deps = {
    engine: {
      loadDataset: vi.fn(),
    },
    errorService: {
      clearFatalLoad: vi.fn(),
      report,
    },
    grid: {
      reset: vi.fn(),
    },
    modalState: {
      open: vi.fn(),
      close: vi.fn(),
    },
    toastState: {
      addInfo: vi.fn(),
      addSuccess: vi.fn(),
    },
    resetWorkspaceHistory: vi.fn(),
  } as any

  return {
    service: new IngestService(deps),
    deps,
    report,
    workerInstances,
  }
}

describe('IngestService', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('reports detached array-buffer read failures through the ingest error pipeline', async () => {
    const { service, deps, report, workerInstances } = await loadHarness(
      message => {
        if (message.type === 'test-stream') {
          throw new Error('Stream transfer is not supported in this environment')
        }
      }
    )

    const file = {
      name: 'broken.csv',
      size: 12,
      stream: vi.fn(() => new ReadableStream()),
      arrayBuffer: vi.fn().mockRejectedValue(new Error('arrayBuffer failed')),
    }

    const resultPromise = service.loadFiles(createFileList([file]))

    await vi.waitFor(() => {
      expect(report).toHaveBeenCalledTimes(1)
    })

    const result = await resultPromise

    expect(result).toBe(false)
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: 'ingest',
        severity: 'fatal-load',
        userMessage: 'Could not process the file: arrayBuffer failed',
        context: expect.objectContaining({
          fileNames: ['broken.csv'],
          fileSizes: [12],
          stage: 'read-array-buffer',
          fileIndex: 0,
          fileName: 'broken.csv',
        }),
      })
    )
    expect(service.status).toBe('error')
    expect(deps.grid.reset).toHaveBeenCalledWith([])
    expect(deps.resetWorkspaceHistory).toHaveBeenCalledTimes(1)
    expect(workerInstances[0]?.terminate).toHaveBeenCalledTimes(1)
  })

  it('reports worker postMessage dispatch failures during stream transfer', async () => {
    const dispatchError = new Error('stream dispatch failed')
    const { service, report, workerInstances } = await loadHarness(message => {
      if (message.type === 'stream') {
        throw dispatchError
      }
    })

    const file = {
      name: 'dispatch.csv',
      size: 24,
      stream: vi.fn(() => new ReadableStream()),
      arrayBuffer: vi.fn(),
    }

    const resultPromise = service.loadFiles(createFileList([file]))

    await vi.waitFor(() => {
      expect(report).toHaveBeenCalledTimes(1)
    })

    const result = await resultPromise

    expect(result).toBe(false)
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: 'ingest',
        severity: 'fatal-load',
        userMessage: 'Could not process the file: stream dispatch failed',
        cause: dispatchError,
        context: expect.objectContaining({
          fileNames: ['dispatch.csv'],
          fileSizes: [24],
          workerMessageType: 'stream',
          stage: 'dispatch-stream',
          fileIndex: 0,
          fileName: 'dispatch.csv',
        }),
      })
    )
    expect(file.arrayBuffer).not.toHaveBeenCalled()
    expect(workerInstances[0]?.terminate).toHaveBeenCalledTimes(1)
  })
})
