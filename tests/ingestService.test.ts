import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createFileList,
  createIngestDeps,
  stubWorkerGlobals,
  type PostedMessage,
} from './helpers/ingestServiceHarness'

async function loadHarness(
  workerPostMessage: (message: PostedMessage) => void
) {
  vi.resetModules()

  const { workerInstances } = stubWorkerGlobals(workerPostMessage)

  const { IngestService } = await import('$lib/data/ingest/service.svelte')
  const { deps, report } = createIngestDeps()

  return {
    service: new IngestService(deps as any),
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
    }, { timeout: 25000 })

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
  }, 30000)

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

  it('applyEmpty resets state to ready and clears all errors', async () => {
    const { service, deps } = await loadHarness(() => {})

    service.applyEmpty()

    expect(service.status).toBe('ready')
    expect(service.isLoading).toBe(false)
    expect(service.metadata).toBeNull()
    expect(service.input).toBeNull()
    expect(service.progressPercent).toBe(0)
    expect(deps.errorService.clearAll).toHaveBeenCalledTimes(1)
    expect(deps.engine.loadDataset).toHaveBeenCalledTimes(1)
    expect(deps.grid.reset).toHaveBeenCalledTimes(1)
    expect(deps.resetWorkspaceHistory).toHaveBeenCalledTimes(1)
  })

  it('derived status reflects errorService.fatalLoad regardless of explicitStatus', async () => {
    vi.resetModules()
    stubWorkerGlobals()

    const { IngestService } = await import('$lib/data/ingest/service.svelte')
    const { ErrorService } = await import('$lib/errors')

    const toastState = {
      addError: vi.fn(),
      addInfo: vi.fn(),
      addSuccess: vi.fn(),
    }

    function makeService(errorService: any) {
      return new IngestService({
        engine: { loadDataset: vi.fn() },
        errorService,
        grid: { reset: vi.fn(), clearSelection: vi.fn() },
        modalState: { open: vi.fn(), close: vi.fn() },
        toastState,
        resetWorkspaceHistory: vi.fn(),
      } as any)
    }

    // We construct a fresh IngestService per observation point rather than
    // mutating one in place. Cross-instance `$derived` invalidation isn't
    // reliable outside a Svelte component scope, but each fresh derivation
    // reads `errorService.fatalLoad` correctly on its first evaluation, which
    // is what we want to assert: the truth table of the derivation.

    // Case 1: no fatalLoad → status follows explicitStatus.
    const cleanErrors = new ErrorService(toastState)
    const readyService = makeService(cleanErrors)
    readyService.applyEmpty() // explicitStatus = 'ready'
    expect(readyService.status).toBe('ready')

    // Case 2: fatalLoad set on errorService, observed by a fresh service whose
    //         explicitStatus is still the initial 'loading' → 'error' wins.
    const dirtyErrors = new ErrorService(toastState)
    dirtyErrors.report({
      origin: 'plot',
      severity: 'fatal-load',
      userMessage: 'plot stage exploded',
      cause: new Error('boom'),
    })
    const erroredService = makeService(dirtyErrors)
    expect(erroredService.status).toBe('error')

    // Case 3: explicit = 'ready' AND fatalLoad set → 'error' wins (load-bearing
    //         claim). Ordering matters: we must call applyEmpty FIRST (it calls
    //         clearAll → fatalLoad := null), THEN report a fatal-load from
    //         elsewhere, THEN read `status` for the first time so the lazy
    //         derivation captures both inputs in one evaluation.
    const errors3 = new ErrorService(toastState)
    const service3 = makeService(errors3)
    service3.applyEmpty()
    errors3.report({
      origin: 'plot',
      severity: 'fatal-load',
      userMessage: 'plot stage exploded after ingest went ready',
      cause: new Error('boom'),
    })
    expect(service3.status).toBe('error')

    // Case 4: fatalLoad cleared on the same errorService → fresh service sees
    //         explicit again.
    dirtyErrors.clearFatalLoad()
    const recoveredService = makeService(dirtyErrors)
    recoveredService.applyEmpty()
    expect(recoveredService.status).toBe('ready')
  })

  it('clears the grid selection before the worker starts parsing', async () => {
    // Snapshot at the moment the worker first receives anything: an
    // implementation that cleared at commit (in applyParsedData / applyFailure,
    // after the worker replies) would leave the pane, the off-screen arrow and
    // the mobile plot rail on plots the loading screen has already hidden.
    let clearedBeforeWorkerSaw: boolean | null = null
    let harness: Awaited<ReturnType<typeof loadHarness>>

    harness = await loadHarness(message => {
      clearedBeforeWorkerSaw ??=
        harness.deps.grid.clearSelection.mock.calls.length > 0
      if (message.type === 'test-stream') {
        throw new Error('Stream transfer is not supported in this environment')
      }
    })

    const file = {
      name: 'selection.csv',
      size: 3,
      stream: vi.fn(() => new ReadableStream()),
      arrayBuffer: vi.fn().mockRejectedValue(new Error('arrayBuffer failed')),
    } as unknown as File

    await harness.service.loadFiles([file])

    expect(clearedBeforeWorkerSaw).toBe(true)
    expect(harness.deps.grid.clearSelection).toHaveBeenCalledTimes(1)
  }, 15000)

  it('loadFiles accepts a plain File[] (not just FileList)', async () => {
    const { service, report, workerInstances } = await loadHarness(message => {
      if (message.type === 'test-stream') {
        throw new Error('Stream transfer is not supported in this environment')
      }
    })

    const file = {
      name: 'plain-array.csv',
      size: 7,
      stream: vi.fn(() => new ReadableStream()),
      arrayBuffer: vi.fn().mockRejectedValue(new Error('arrayBuffer failed')),
    } as unknown as File

    const result = await service.loadFiles([file])

    expect(result).toBe(false)
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          fileNames: ['plain-array.csv'],
          fileSizes: [7],
        }),
      })
    )
    expect(workerInstances[0]?.terminate).toHaveBeenCalledTimes(1)
  }, 15000)
})
