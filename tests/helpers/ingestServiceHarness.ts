import { vi } from 'vitest'

// ---- IngestService harness (main-thread side) ----

export type PostedMessage = { type: string; data?: unknown }

export function createFileList(files: unknown[]): FileList {
  return Object.assign(files, {
    item: (index: number) => files[index] ?? null,
  }) as unknown as FileList
}

/** Stubs Worker + navigator; logs every postMessage and registers instances. */
export function stubWorkerGlobals(
  onPostMessage?: (message: PostedMessage) => void
) {
  const posted: PostedMessage[] = []
  const workerInstances: FakeWorker[] = []

  class FakeWorker {
    onmessage: ((event: { data: unknown }) => void) | null = null
    onerror: ((event: unknown) => void) | null = null
    onmessageerror: ((event: unknown) => void) | null = null
    postMessage = vi.fn((message: PostedMessage) => {
      posted.push(message)
      onPostMessage?.(message)
    })
    terminate = vi.fn()

    constructor(_url: URL, _options: { type: string }) {
      workerInstances.push(this)
    }
  }

  vi.stubGlobal('Worker', FakeWorker as unknown as typeof Worker)
  vi.stubGlobal('navigator', { userAgent: 'vitest' })

  return { posted, workerInstances }
}

/** Mocked IngestService deps; `report` echoes its input as an ErrorRecord. */
export function createIngestDeps() {
  const report = vi.fn(
    (input: {
      origin: string
      severity: string
      userMessage: string
      cause: unknown
      context?: Record<string, unknown>
    }) => ({
      id: 1,
      createdAt: '2026-03-13T00:00:00.000Z',
      origin: input.origin,
      severity: input.severity,
      userMessage: input.userMessage,
      debugMessage:
        input.cause instanceof Error
          ? input.cause.message
          : String(input.cause),
      stack: input.cause instanceof Error ? input.cause.stack : undefined,
      context: input.context,
    })
  )

  const deps = {
    engine: { loadDataset: vi.fn(), metadata: null },
    errorService: { clearAll: vi.fn(), clearFatalLoad: vi.fn(), report },
    grid: { reset: vi.fn(), clearSelection: vi.fn() },
    modalState: { open: vi.fn(), close: vi.fn() },
    toastState: {
      addInfo: vi.fn(),
      addSuccess: vi.fn(),
      addWarning: vi.fn(),
    },
    resetWorkspaceHistory: vi.fn(),
  }

  return { deps, report }
}

// ---- Worker-boot harness (drives the REAL worker module) ----

type Posted = { message: any; options?: { transfer?: unknown[] } }

export const posted: Posted[] = []

let workerSelf: {
  postMessage: (message: unknown, options?: { transfer?: unknown[] }) => void
  onmessage: ((event: { data: unknown }) => Promise<void>) | null
}

export async function bootWorker() {
  posted.length = 0
  // Inherit from globalThis so transitive deps that environment-sniff via
  // `self` (jszip -> setimmediate) still find node's scheduling primitives.
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

export const send = (type: string, data?: unknown) =>
  workerSelf.onmessage!({ data: { type, data } })

export function resetWorkerGlobals() {
  vi.unstubAllGlobals()
  vi.resetModules()
}
