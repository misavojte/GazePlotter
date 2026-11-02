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

  const { IngestService } = await import('$lib/session/ingestService.svelte')
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

  it('reports worker postMessage dispatch failures during file dispatch', async () => {
    const dispatchError = new Error('file dispatch failed')
    const { service, report, workerInstances } = await loadHarness(message => {
      if (message.type === 'file') {
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
        userMessage: 'Could not process the file: file dispatch failed',
        cause: dispatchError,
        context: expect.objectContaining({
          fileNames: ['dispatch.csv'],
          fileSizes: [24],
          workerMessageType: 'file',
          stage: 'dispatch-file',
          fileIndex: 0,
          fileName: 'dispatch.csv',
        }),
      })
    )
    // The worker reads the file; the main thread never touches its bytes.
    expect(file.arrayBuffer).not.toHaveBeenCalled()
    expect(file.stream).not.toHaveBeenCalled()
    expect(workerInstances[0]?.terminate).toHaveBeenCalledTimes(1)
    // First test in the file: pays the cold service-module import.
  }, 30000)

  it('applyEmpty resets state to ready and clears all errors', async () => {
    const { service, deps } = await loadHarness(() => {})

    service.applyEmpty()

    expect(service.status).toBe('ready')
    expect(service.isLoading).toBe(false)
    expect(service.metadata).toBeNull()
    expect(service.input).toBeNull()
    expect(service.reading).toBeNull()
    expect(deps.errorService.clearAll).toHaveBeenCalledTimes(1)
    expect(deps.engine.loadDataset).toHaveBeenCalledTimes(1)
    expect(deps.grid.reset).toHaveBeenCalledTimes(1)
    expect(deps.resetWorkspaceHistory).toHaveBeenCalledTimes(1)
  })

  it('derived status reflects errorService.fatalLoad regardless of explicitStatus', async () => {
    vi.resetModules()
    stubWorkerGlobals()

    const { IngestService } = await import('$lib/session/ingestService.svelte')
    const { ErrorService } = await import('$lib/errors')

    const toastState = {
      addError: vi.fn(),
      addInfo: vi.fn(),
      addSuccess: vi.fn(),
    }

    function makeService(errorService: any) {
      return new IngestService({
        engine: { loadDataset: vi.fn(), setStimulusMediaBlobs: vi.fn(() => []) },
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
      if (message.type === 'file') {
        throw new Error('file dispatch failed')
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

  it('a user upload during the host download supersedes it', async () => {
    const { service, report, workerInstances } = await loadHarness(message => {
      if (message.type === 'file') throw new Error('file dispatch failed')
    })
    service.applyEmpty()

    // Ignores its signal and resolves late: the worst case for the race.
    let hostSignal!: AbortSignal
    let resolveHost!: (files: File[]) => void
    const host = service.loadFromHost((signal, onProgress) => {
      hostSignal = signal
      onProgress({ loaded: 1, total: 10, waiting: null })
      return new Promise(resolve => (resolveHost = resolve))
    })
    expect(service.isLoading).toBe(true)
    expect(service.download).toEqual({ loaded: 1, total: 10, waiting: null })

    const userFile = {
      name: 'user.csv',
      size: 4,
      stream: vi.fn(() => new ReadableStream()),
      arrayBuffer: vi.fn(),
    } as unknown as File
    await service.loadFiles([userFile])

    expect(hostSignal.aborted).toBe(true)
    expect(service.download).toBeNull()
    resolveHost([{ name: 'demo.gazeplotter', size: 9 } as File])
    await host
    // Only the user's parse ever started; the demo never replaced it.
    expect(workerInstances).toHaveLength(1)
    expect(report).not.toHaveBeenCalledWith(
      expect.objectContaining({ origin: 'bootstrap' })
    )
  }, 15000)

  it('reports a failed host load and retries it with the same loader', async () => {
    const { service, report } = await loadHarness(() => {})
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error('The download stopped at 3 MB of 70 MB.'))
      .mockResolvedValueOnce([])

    await service.loadFromHost(loader)
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: 'bootstrap',
        severity: 'fatal-load',
        userMessage: 'The download stopped at 3 MB of 70 MB.',
      })
    )
    expect(service.download).toBeNull()

    service.retryHostLoad()
    await vi.waitFor(() => expect(service.status).toBe('ready'))
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('reports a parse like a download: the upload, then the bytes the parser reads', async () => {
    const { service, workerInstances } = await loadHarness(() => {})
    const data = {
      name: 'study.tsv',
      size: 10,
      stream: vi.fn(() => new ReadableStream()),
      arrayBuffer: vi.fn(),
    } as unknown as File
    const image = { name: 'map.png', type: 'image/png', size: 90 } as unknown as File

    const result = service.loadFiles([data, image])
    const source = 'study.tsv and 1 more'
    expect(service.reading).toEqual({ source, loaded: 0, total: 100, waiting: null })

    // The image is attached, not parsed: the total narrows to the data file.
    await vi.waitFor(() => expect(service.reading?.total).toBe(10))
    const worker = workerInstances[0]
    worker.onmessage?.({ data: { type: 'progress', processedBytes: 4 } })
    expect(service.reading).toEqual({ source, loaded: 4, total: 10, waiting: null })
    // Never past the total, whatever the parser counts.
    worker.onmessage?.({ data: { type: 'progress', processedBytes: 40 } })
    expect(service.reading?.loaded).toBe(10)

    worker.onmessage?.({ data: { type: 'fail', data: new Error('bad row') } })
    await result
    expect(service.reading).toBeNull()
  }, 15000)

  it('refuses an upload during a parse before asking to replace anything', async () => {
    const { service, deps } = await loadHarness(() => {})
    const confirmReplace = vi.fn(() => true)
    Object.assign(deps, { confirmReplace })
    const file = (name: string) =>
      ({ name, size: 3, stream: vi.fn(() => new ReadableStream()), arrayBuffer: vi.fn() }) as unknown as File

    void service.loadFiles([file('first.csv')])
    confirmReplace.mockClear()

    expect(await service.loadFiles([file('second.csv')])).toBe(false)
    expect(confirmReplace).not.toHaveBeenCalled()
    expect(deps.toastState.addInfo).toHaveBeenCalledWith(
      'Data is still loading. Try again when it has finished.'
    )
  }, 15000)

  it('a media-only upload never passes through loading, so the plots stay up', async () => {
    const { service, deps } = await loadHarness(() => {})
    service.applyEmpty()
    const image = { name: 'map.png', type: 'image/png', size: 9 } as unknown as File

    const result = service.loadFiles([image])
    expect(service.status).toBe('ready')
    await result
    expect(deps.grid.clearSelection).not.toHaveBeenCalled()
    expect(service.status).toBe('ready')
  }, 15000)

  it('loadFiles accepts a plain File[] (not just FileList)', async () => {
    const { service, report, workerInstances } = await loadHarness(message => {
      if (message.type === 'file') {
        throw new Error('file dispatch failed')
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
