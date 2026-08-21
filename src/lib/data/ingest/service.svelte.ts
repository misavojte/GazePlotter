import { eventFileMappingModal } from '$lib/modals/import/definitions'
import {
  processAoiVisibilityFromText,
  buildEventChannelsFromParsed,
} from '$lib/modals/import/shared/aoiVisibilityServices'
import {
  buildDataTypeFromCsvEvents,
  parseCsvEventText,
  resolveContributionsForEngine,
  mergeIntoStimulusMap,
} from './formats/csvEvent'
import {
  detectEnrichmentFormat,
} from './formats/registry'
import { foldMerges } from '$lib/data/merge/applyMerges'
import type { EnrichmentFormatDefinition } from './kernel/format'
import type { EventContribution } from './kernel/sink'
import { probeFromText } from './kernel/source'
import { getStimuliOptions, getParticipantOptions } from '$lib/plots/shared'
import { getStimulusHighestEndTime } from '$lib/data/engine'
import { isArchiveFileName } from './formats/routing'
import { INGEST_PROMPTS } from './prompts'
import type { IngestResult } from './kernel/result'
import { EVENT_ONLY_GRID_STATE_DATA } from '$lib/workspace'
import { GAZEPLOTTER_VERSION } from '$lib/version'
import type { OpenFiles } from './openFiles'
import type { ErrorService } from '$lib/errors'
import { formatDuration } from '$lib/shared/utils/timeUtils'
import { formatFileSize } from '$lib/shared/utils/fileUtils'
import type { DataType, ParsedData } from '$lib/data/types'
import { createDefaultMetricInstances } from '$lib/metrics/instances'
import type {
  ParseSettings,
  FileInputType,
  FileMetadataFailureType,
  FileMetadataSuccessType,
  FileMetadataType,
} from './types'
import type { ModalState } from '$lib/modals/modalState.svelte'
import type { ToastState } from '$lib/toaster/toastState.svelte'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { GridState } from '$lib/workspace/grid/gridState.svelte'
import type { GridItemSnapshot } from '$lib/workspace/grid/types'

export type IngestStatus = 'loading' | 'ready' | 'error'

type IngestUiServices = {
  errorService: Pick<ErrorService, 'report'>
  modalState: Pick<ModalState, 'open'>
  toastState: Pick<ToastState, 'addInfo' | 'addSuccess' | 'addWarning'>
}

type IngestDependencies = {
  engine: DataEngine
  errorService: ErrorService
  grid: GridState
  modalState: ModalState
  toastState: ToastState
  resetWorkspaceHistory: () => void
  /** Session-resolved embedding options (see PLANDESKTOP.md). */
  defaultLayout: GridItemSnapshot[]
  openFiles: OpenFiles
}

/** Fresh empty dataset per load. The engine takes ownership of what it loads
 *  (order vectors and metric instances are edited in place), so a shared
 *  singleton would leak edits from one empty session into the next. */
function createEmptyDataset(): DataType {
  return {
    isOrdinalOnly: false,
    capabilities: {
      segmented: false,
      spatial: false,
      event: false,
    },
    stimuli: { data: [], orderVector: [] },
    participants: { data: [], orderVector: [] },
    participantsSelections: [],
    stimuliSelections: [],
    categoriesSelections: [],
    eventsSelections: [],
    metricInstances: createDefaultMetricInstances(),
    categories: { data: [], orderVector: [] },
    noAoiTreatment: {
      color: '#cbd5e1',
      displayedName: 'No AOI',
    },
    aois: {
      data: [],
      orderVector: [],
    },
    segments: {
      segmentBuffer: new Float32Array(0),
      indexTable: new Uint32Array(0),
      aoiPool: new Uint16Array(0),
      hasSpatialData: false,
      maxParticipants: 0,
      stimuliCount: 0,
    },
    eventData: {
      data: [],
      orderVector: [],
      events: [],
    },
  }
}

/**
 * Formats file information for display in success messages.
 */
function formatFileInfo(fileNames: string[], fileSizes: number[]): string {
  if (fileNames.length === 0) return ''

  if (fileNames.length === 1) {
    return `${fileNames[0]} (${formatFileSize(fileSizes[0])})`
  }

  const totalSize = fileSizes.reduce((sum, size) => sum + size, 0)
  const fileCount = fileNames.length
  let fileInfo = `${fileCount} files (${formatFileSize(totalSize)})`

  const maxNamesToShow = 3
  if (fileNames.length <= maxNamesToShow) {
    fileInfo += `: ${fileNames.join(', ')}`
  } else {
    const shownNames = fileNames.slice(0, maxNamesToShow).join(', ')
    const remainingCount = fileNames.length - maxNamesToShow
    fileInfo += `: ${shownNames} and ${remainingCount} more`
  }

  return fileInfo
}

/** An upload file claimed by an enrichment format during partition. */
type ClaimedEventFile = {
  file: File
  format: EnrichmentFormatDefinition
}

/**
 * Partitions uploaded files into eye-tracking sources (for the worker job)
 * and event files (claimed by ENRICHMENT_FORMATS, consumed post-load).
 * Detection is registry-driven — the same ordered contract as gaze
 * formats. One routing policy lives here, not in a format: a LONE .json
 * upload is never an event file (workspace first-file-wins precedence).
 */
async function partitionUploadFiles(
  files: File[]
): Promise<{ eyeFiles: File[]; eventFiles: ClaimedEventFile[] }> {
  const eyeFiles: File[] = []
  const eventFiles: ClaimedEventFile[] = []
  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'json' && files.length === 1) {
      eyeFiles.push(file)
      continue
    }
    try {
      const slice = await file.slice(0, 256 * 1024).text()
      const probe = probeFromText(slice, { fileName: file.name })
      const format = detectEnrichmentFormat(probe)
      if (format) {
        eventFiles.push({ file, format })
        continue
      }
    } catch {
      // Unreadable probe → let the worker job report the real error.
    }
    eyeFiles.push(file)
  }
  return { eyeFiles, eventFiles }
}

class IngestWorkerClient {
  private worker: Worker
  private parsingSumTime = 0
  private parsingAnchorTime = 0
  private fileNames: string[] = []
  private fileSizes: number[] = []
  private totalFileSize = 0
  private isSettled = false

  constructor(
    private readonly onData: (data: ParsedData) => void,
    private readonly onFail: (failureMetadata: FileMetadataFailureType) => void,
    private readonly onProgress: (progressPercent: number) => void,
    private readonly ui: IngestUiServices
  ) {
    this.worker = new Worker(
      new URL('$lib/data/ingest/worker.ts', import.meta.url),
      { type: 'module' }
    )
    this.worker.onmessage = this.handleMessage.bind(this)
    this.worker.onmessageerror = () =>
      this.handleError(
        new Error('File processing worker sent an unreadable message'),
        {
          stage: 'worker-messageerror',
        }
      )
    this.worker.onerror = (event: ErrorEvent) =>
      this.handleError(
        event.error ??
          new Error(event.message || 'File processing worker failed')
      )
  }

  sendFiles(files: File[]): void {
    const fileArray = files
    this.fileNames = fileArray.map(file => file.name)
    this.fileSizes = fileArray.map(file => file.size)
    this.totalFileSize = this.fileSizes.reduce((sum, size) => sum + size, 0)
    this.parsingSumTime = 0
    this.parsingAnchorTime = Date.now()
    this.onProgress(0)

    if (
      !this.postWorkerMessage(
        { type: 'file-names', data: this.fileNames },
        [],
        { stage: 'initialize-worker' }
      )
    ) {
      return
    }

    // Archive formats need fully-materialized buffers (JSZip can't stream);
    // everything else — including workspace JSON — streams to the worker.
    if (isArchiveFileName(fileArray[0].name)) {
      void this.processZipFiles(fileArray)
    } else if (this.isStreamTransferable()) {
      this.processDataAsStream(fileArray)
    } else {
      void this.processDataAsArrayBuffer(fileArray)
    }
  }

  private static isStreamTransferableCached: boolean | null = null

  private isStreamTransferable(): boolean {
    if (IngestWorkerClient.isStreamTransferableCached !== null) {
      return IngestWorkerClient.isStreamTransferableCached
    }

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([]))
        controller.close()
      },
    })

    try {
      this.worker.postMessage({ type: 'test-stream', data: stream }, [stream])
      IngestWorkerClient.isStreamTransferableCached = true
      return true
    } catch {
      IngestWorkerClient.isStreamTransferableCached = false
      return false
    }
  }

  private markSettled(): boolean {
    if (this.isSettled) return false
    this.isSettled = true
    this.worker.terminate()
    return true
  }

  private postWorkerMessage(
    message: { type: string; data: unknown },
    transfer: Transferable[] = [],
    extraContext?: Record<string, unknown>
  ): boolean {
    if (this.isSettled) return false

    try {
      if (transfer.length > 0) {
        this.worker.postMessage(message, transfer)
      } else {
        this.worker.postMessage(message)
      }
      return true
    } catch (error) {
      this.handleError(error, {
        workerMessageType: message.type,
        ...(extraContext ?? {}),
      })
      return false
    }
  }

  private processDataAsStream(files: File[]): void {
    for (let index = 0; index < files.length; index++) {
      const stream = files[index].stream()
      if (
        !this.postWorkerMessage({ type: 'stream', data: stream }, [stream], {
          stage: 'dispatch-stream',
          fileIndex: index,
          fileName: files[index].name,
        })
      ) {
        return
      }
    }
  }

  private async processDataAsArrayBuffer(files: File[]): Promise<void> {
    for (let index = 0; index < files.length; index++) {
      const file = files[index]

      try {
        const buffer = await file.arrayBuffer()
        if (
          !this.postWorkerMessage({ type: 'buffer', data: buffer }, [buffer], {
            stage: 'dispatch-buffer',
            fileIndex: index,
            fileName: file.name,
          })
        ) {
          return
        }
      } catch (error) {
        this.handleError(error, {
          stage: 'read-array-buffer',
          fileIndex: index,
          fileName: file.name,
        })
        return
      }
    }
  }

  private async processZipFiles(files: File[]): Promise<void> {
    for (let index = 0; index < files.length; index++) {
      const file = files[index]

      try {
        const buffer = await file.arrayBuffer()
        const zipName = this.fileNames[index]
        if (
          !this.postWorkerMessage(
            { type: 'zip-buffer', data: { buffer, zipName } },
            [buffer],
            {
              stage: 'dispatch-zip-buffer',
              fileIndex: index,
              fileName: file.name,
              zipName,
            }
          )
        ) {
          return
        }
      } catch (error) {
        this.handleError(error, {
          stage: 'read-zip-buffer',
          fileIndex: index,
          fileName: file.name,
        })
        return
      }
    }
  }

  private handleDone(result: IngestResult): void {
    if (result.kind === 'workspace') {
      this.handleWorkspaceDone(result)
      return
    }
    if (result.warnings?.length) {
      for (const warning of result.warnings) {
        this.ui.toastState.addWarning(warning)
      }
    }
    const excluded = result.data.dataExclusions
    if (excluded?.length) {
      this.ui.toastState.addWarning(
        `${excluded.length} participant-stimulus group${excluded.length > 1 ? 's were' : ' was'} excluded for malformed interval markers. Open Metadata for the full report.`
      )
    }
    // Fresh datasets are seeded with the starter metric library HERE, on the
    // main thread — the worker's segment writer emits an empty list so it never
    // bundles the metric registry. Workspace results never pass through this
    // branch; they carry their own (user-curated) instances.
    result.data.metricInstances = createDefaultMetricInstances()
    this.handleData({ data: result.data, classified: result.settings })
  }

  private handleWorkspaceDone(
    result: Extract<IngestResult, { kind: 'workspace' }>
  ): void {
    // Settle before any user feedback — a cancelled upload whose 'done'
    // message was already queued must not toast success.
    if (!this.markSettled()) return
    this.onProgress(100)
    const timeString = formatDuration(
      Date.now() - this.parsingAnchorTime + this.parsingSumTime
    )
    const formattedFileInfo = formatFileInfo(this.fileNames, this.fileSizes)
    this.ui.toastState.addSuccess(
      `${formattedFileInfo} workspace loaded successfully in ${timeString}`
    )

    this.onData({
      version: result.version as ParsedData['version'],
      data: result.data,
      gridItems: result.gridItems,
      fileMetadata: result.fileMetadata,
      current: {
        fileNames: this.fileNames,
        fileSizes: this.fileSizes,
        parseDate: new Date().toISOString(),
      },
    })
  }

  private handleData({
    data,
    classified,
  }: {
    data: DataType
    classified: ParseSettings
  }): void {
    // Settle before any user feedback — see handleWorkspaceDone.
    if (!this.markSettled()) return
    const parseDuration =
      Date.now() - this.parsingAnchorTime + this.parsingSumTime
    const fileMetadata: FileMetadataSuccessType = {
      status: 'success',
      fileNames: this.fileNames,
      fileSizes: this.fileSizes,
      parseSettings: classified,
      parseDate: new Date().toISOString(),
      parseDuration,
      gazePlotterVersion: GAZEPLOTTER_VERSION,
      clientUserAgent: navigator.userAgent,
    }
    const timeString = formatDuration(parseDuration)
    const formattedFileInfo = formatFileInfo(this.fileNames, this.fileSizes)
    this.onProgress(100)
    this.ui.toastState.addSuccess(
      `${formattedFileInfo} parsed successfully in ${timeString}`
    )

    this.onData({
      data,
      fileMetadata,
      version: 4,
      current: {
        fileNames: this.fileNames,
        fileSizes: this.fileSizes,
        parseDate: new Date().toISOString(),
      },
      freshDataset: true,
    } as ParsedData)
  }

  private handleMessage(event: MessageEvent): void {
    switch (event.data.type) {
      case 'progress':
        this.handleProgress(event.data.processedBytes)
        break
      case 'done':
        this.handleDone(event.data.result)
        break
      case 'fail':
        this.handleError(event.data.data)
        break
      case 'prompt':
        this.handlePromptRequest(event.data.promptId)
        break
      default: {
        const workerMessageType =
          typeof event.data?.type === 'string'
            ? event.data.type
            : String(event.data?.type ?? 'unknown')
        this.handleError(
          new Error(
            `Ingest worker sent unsupported message type: ${workerMessageType}`
          ),
          {
            workerMessageType,
          }
        )
        break
      }
    }
  }

  private handleProgress(processedBytes: number): void {
    if (this.isSettled) return

    if (typeof processedBytes !== 'number' || this.totalFileSize <= 0) {
      this.onProgress(0)
      return
    }

    const ratio = processedBytes / this.totalFileSize
    const progressPercent = Math.floor(Math.min(Math.max(ratio, 0), 0.99) * 100)
    this.onProgress(progressPercent)
  }

  private handleError(
    error: unknown,
    extraContext?: Record<string, unknown>
  ): void {
    if (!this.markSettled()) return

    const fallbackMessage = 'Unknown error'
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : fallbackMessage
    const record = this.ui.errorService.report({
      origin: 'ingest',
      severity: 'fatal-load',
      userMessage: `Could not process the file: ${message}`,
      cause: error,
      context: {
        fileNames: this.fileNames,
        fileSizes: this.fileSizes,
        ...(extraContext ?? {}),
      },
    })

    const attemptedParseDuration =
      this.parsingAnchorTime > 0
        ? Date.now() - this.parsingAnchorTime + this.parsingSumTime
        : undefined

    const failureMetadata = {
      status: 'failure',
      fileNames: this.fileNames.length > 0 ? this.fileNames : ['Unknown file'],
      fileSizes: this.fileSizes,
      parseDate: new Date().toISOString(),
      errorId: record.id,
      errorCreatedAt: record.createdAt,
      userMessage: record.userMessage,
      debugMessage: record.debugMessage,
      stack: record.stack,
      attemptedParseDuration,
      gazePlotterVersion: GAZEPLOTTER_VERSION,
      clientUserAgent: navigator.userAgent,
    } satisfies FileMetadataFailureType

    this.onFail(failureMetadata)
  }

  private handlePromptRequest(promptId: string): void {
    this.parsingSumTime += Date.now() - this.parsingAnchorTime
    this.openPrompt(promptId)
      .then(userInput => {
        this.parsingAnchorTime = Date.now()
        // The prompt modal is already popped by the time `open` resolves
        // (finish/close pop before resolving) — closing here again would
        // pop whatever unrelated modal happens to be active.
        this.postWorkerMessage(
          { type: 'prompt-response', data: userInput },
          [],
          { stage: 'dispatch-prompt-response', promptId }
        )
      })
      .catch(error => {
        this.handleError(error, { stage: 'ingest-prompt', promptId })
      })
  }

  private openPrompt(promptId: string): Promise<string> {
    const spec = INGEST_PROMPTS[promptId]
    if (!spec) {
      return Promise.reject(
        new Error(`Unknown ingest prompt requested by worker: ${promptId}`)
      )
    }
    return this.ui.modalState.open(spec.modal, {}).then(value => {
      if (value !== null) {
        return value
      }

      if (spec.cancelToast) this.ui.toastState.addInfo(spec.cancelToast)
      return spec.cancelValue
    })
  }
}

export class IngestService {
  private explicitStatus = $state<IngestStatus>('loading')
  metadata = $state<FileMetadataType | null>(null)
  input = $state<FileInputType | null>(null)
  progressPercent = $state(0)

  /** True while a worker parse is running — uploads are one at a time. */
  private uploadInFlight = false

  // Any `errorService.fatalLoad` — regardless of `origin` — implies the dataset
  // is unusable, so ingest reflects 'error' without each fatal-load reporter
  // having to mark ingest separately. Today all `fatal-load` reports come from
  // bootstrap/ingest; a future caller reporting one from another origin
  // (plot/export/…) will also flip ingest into error state via this derivation.
  status = $derived<IngestStatus>(
    this.deps.errorService.fatalLoad ? 'error' : this.explicitStatus
  )
  isLoading = $derived(this.status === 'loading')

  constructor(private readonly deps: IngestDependencies) {}

  /** Open the host's file source and load the pick; `[]` means cancelled. */
  async openAndLoadFiles(): Promise<boolean> {
    const files = await this.deps.openFiles()
    return files.length > 0 ? this.loadFiles(files) : false
  }

  async loadFiles(files: FileList | readonly File[]): Promise<boolean> {
    if (files.length === 0) return false

    // One upload at a time: a second drop while a parse is running would
    // spawn a competing worker racing to commit into the same session.
    // There is deliberately no cancel — a started load always runs to
    // success or failure and the outcome stays visible.
    if (this.uploadInFlight) {
      this.deps.toastState.addInfo(
        'A file upload is already in progress. Wait for it to finish.'
      )
      return false
    }
    this.uploadInFlight = true

    this.deps.errorService.clearAll()
    this.explicitStatus = 'loading'
    this.progressPercent = 0

    try {
      const allFiles = Array.from(files)
      const { eyeFiles, eventFiles } = await partitionUploadFiles(allFiles)

      if (eyeFiles.length === 0 && eventFiles.length > 0) {
        // CSV event files carry their own stimulus/participant names, so they
        // can stand alone as an event-only dataset (Event Comparison is its
        // native plot; gaze analysis hides off `segmented: false`). XML/JSON
        // event files map onto EXISTING stimuli via a modal, so those still
        // require eye-tracking data.
        return await this.processStandaloneEventFiles(eventFiles)
      }

      // The parse is now committed, so the selection into the grid it replaces
      // dies here: the pane, the off-screen arrow and the mobile plot rail
      // follow it. Not earlier — the refusals above leave the grid standing.
      this.deps.grid.clearSelection()

      return await new Promise<boolean>(resolve => {
        const client = new IngestWorkerClient(
          async data => {
            // Pass 1: load eye-tracking data into engine
            this.applyParsedData(data)

            // Pass 2: if event files exist, process them using the now-loaded engine
            if (eventFiles.length > 0) {
              try {
                await this.processEventFilesPostLoad(eventFiles)
              } catch (error) {
                this.deps.errorService.report({
                  origin: 'ingest',
                  severity: 'recoverable',
                  userMessage:
                    'Event files could not be processed. Eye-tracking data was loaded without events.',
                  cause: error,
                  context: {
                    eventFileNames: eventFiles.map(e => e.file.name),
                  },
                })
              }
            }

            resolve(true)
          },
          failureMetadata => {
            this.applyFailure(failureMetadata)
            resolve(false)
          },
          progressPercent => {
            this.progressPercent = progressPercent
          },
          {
            errorService: this.deps.errorService,
            modalState: this.deps.modalState,
            toastState: this.deps.toastState,
          }
        )
        client.sendFiles(eyeFiles)
      })
    } catch (error) {
      this.deps.errorService.report({
        origin: 'ingest',
        severity: 'fatal-load',
        userMessage: 'Unable to set up file processing service',
        cause: error,
        context: {
          fileCount: files.length,
        },
      })
      this.explicitStatus = 'error'
      return false
    } finally {
      this.uploadInFlight = false
    }
  }

  /**
   * Reset the workspace to an empty, ready state — no dataset, no grid,
   * no error, no in-flight loading. Used when a {@link DataLoader} resolves
   * with `[]` (host signals "open with no preloaded data, upload UI ready").
   * Also valid as a public "clear data" entry point for hosts.
   */
  applyEmpty(): void {
    this.deps.errorService.clearAll()
    this.progressPercent = 0
    this.metadata = null
    this.input = null
    this.deps.engine.loadDataset(createEmptyDataset())
    this.deps.grid.reset(this.deps.defaultLayout)
    this.deps.resetWorkspaceHistory()
    this.explicitStatus = 'ready'
  }

  applyParsedData(parsedData: ParsedData): void {
    this.deps.errorService.clearFatalLoad()
    this.progressPercent = 100
    this.metadata =
      parsedData.version >= 3 ? (parsedData.fileMetadata ?? null) : null
    this.input = parsedData.current
    // Original-on-disk (PLANMERGE §4): the file holds the pristine data + the
    // merge log; re-derive the merged working view here. No-op (same object)
    // when nothing was merged, so fresh imports are unaffected.
    this.deps.engine.loadDataset(foldMerges(parsedData.data))
    this.deps.grid.reset(parsedData.gridItems ?? this.deps.defaultLayout)
    this.deps.resetWorkspaceHistory()
    this.explicitStatus = 'ready'
  }

  /**
   * Failure commits the failure state: the workspace shows the persistent
   * error screen (not a transient toast), so a user who stepped away during
   * a long parse sees what happened. Simple rule — `metadata` always
   * describes the VISIBLE dataset, and after a failed parse the visible
   * dataset is the failed (empty) one, never a silently-restored old one.
   */
  applyFailure(failureMetadata: FileMetadataFailureType): void {
    this.progressPercent = 0
    this.deps.grid.reset([])
    this.metadata = failureMetadata
    this.input = {
      fileNames: failureMetadata.fileNames,
      fileSizes: failureMetadata.fileSizes,
      parseDate: failureMetadata.parseDate,
    }
    this.deps.engine.loadDataset(createEmptyDataset())
    this.deps.resetWorkspaceHistory()
    this.explicitStatus = 'error'
  }

  /**
   * Event-only upload: build a dataset from CSV event contributions alone.
   * XML/JSON event files cannot stand alone (their import maps channels onto
   * EXISTING stimuli via a modal), so the upload must contain at least one
   * CSV event file; lone XML/JSON uploads stay a fatal refusal.
   */
  private async processStandaloneEventFiles(
    eventFiles: ClaimedEventFile[]
  ): Promise<boolean> {
    const csvFiles: File[] = []
    const legacyFiles: File[] = []
    for (const { file, format } of eventFiles) {
      if (format.consume === 'contributions') csvFiles.push(file)
      else legacyFiles.push(file)
    }

    if (csvFiles.length === 0) {
      this.deps.errorService.report({
        origin: 'ingest',
        severity: 'fatal-load',
        userMessage:
          'Only XML/JSON event files were uploaded. These annotate eye-tracking data and must be uploaded together with it. Standalone event uploads need CSV event files.',
        cause: new Error('No CSV event files found in event-only upload'),
        context: { eventFileNames: eventFiles.map(e => e.file.name) },
      })
      this.explicitStatus = 'error'
      return false
    }

    if (legacyFiles.length > 0) {
      this.deps.toastState.addWarning(
        `${legacyFiles.length} XML/JSON event file${legacyFiles.length > 1 ? 's' : ''} ignored (they map onto existing eye-tracking data)`
      )
    }

    const contributions: EventContribution[] = []
    const warnings: string[] = []
    for (const file of csvFiles) {
      const text = await file.text()
      const parsed = parseCsvEventText(text)
      warnings.push(...parsed.warnings.map(w => `${file.name}: ${w}`))
      contributions.push(...parsed.contributions)
    }

    if (contributions.length === 0) {
      this.deps.errorService.report({
        origin: 'ingest',
        severity: 'fatal-load',
        userMessage:
          'No valid event data found in the uploaded CSV file(s). Check that the files contain rows with stimulus, participant, eventName, start, and duration columns.',
        cause: new Error('CSV event files produced zero valid rows'),
        context: { csvFileNames: csvFiles.map(f => f.name), warnings },
      })
      this.explicitStatus = 'error'
      return false
    }

    const built = buildDataTypeFromCsvEvents(contributions)
    warnings.push(...built.warnings)
    if (warnings.length > 0) {
      this.deps.toastState.addWarning(
        `Event CSV: ${warnings.length} warning${warnings.length > 1 ? 's' : ''} (${warnings.slice(0, 3).join('; ')}${warnings.length > 3 ? '...' : ''})`
      )
    }

    // Same main-thread seam as handleDone: fresh datasets get their starter
    // metric library here, never in the builder (worker-bundling invariant).
    built.data.metricInstances = createDefaultMetricInstances()

    // The load is now committed, so the selection into the grid it replaces
    // dies here (parity with the eye-tracking path above).
    this.deps.grid.clearSelection()
    this.applyParsedData({
      version: 4,
      data: built.data,
      gridItems: EVENT_ONLY_GRID_STATE_DATA,
      fileMetadata: null,
      current: {
        fileNames: csvFiles.map(f => f.name),
        fileSizes: csvFiles.map(f => f.size),
        parseDate: new Date().toISOString(),
      },
      freshDataset: true,
    })
    this.deps.toastState.addSuccess(
      `Event data loaded: ${formatFileInfo(
        csvFiles.map(f => f.name),
        csvFiles.map(f => f.size)
      )}`
    )
    return true
  }

  private async processEventFilesPostLoad(
    eventFiles: ClaimedEventFile[]
  ): Promise<void> {
    const engine = this.deps.engine
    const meta = engine.metadata
    if (!meta) return

    const participantCount = meta.participants.data.length

    // Partition by consumption mode (claimed formats from the registry)
    const csvFiles: File[] = []
    const legacyFiles: File[] = []
    for (const { file, format } of eventFiles) {
      if (format.consume === 'contributions') {
        csvFiles.push(file)
      } else {
        legacyFiles.push(file)
      }
    }

    // Unified stimulus map for merging both sources
    const stimulusMap = new Map<
      number,
      Map<string, { def: string[]; perParticipant: number[][] }>
    >()

    // --- Process legacy (XML/JSON) event files via mapping modal ---
    if (legacyFiles.length > 0) {
      const mapping = await this.deps.modalState.open(eventFileMappingModal, {
        fileNames: legacyFiles.map(f => f.name),
        stimuliOptions: getStimuliOptions(engine),
        participantOptions: getParticipantOptions(engine),
      })

      if (!mapping && csvFiles.length === 0) {
        this.deps.toastState.addInfo(
          'Event file mapping was cancelled. Data loaded without events.'
        )
        return
      }

      if (mapping) {
        for (let i = 0; i < legacyFiles.length; i++) {
          if (mapping[i].skip) continue
          const { stimulusId, participantId } = mapping[i]
          const text = await legacyFiles[i].text()
          const highestEndTime = getStimulusHighestEndTime(engine, stimulusId)
          const parsed = processAoiVisibilityFromText(text, highestEndTime)
          const aoiData = meta.aois.data[stimulusId]
          const { channelDefs, eventBuffers } = buildEventChannelsFromParsed(
            parsed,
            participantId,
            participantCount,
            aoiData
          )

          const legacyMap = new Map<
            string,
            { def: string[]; perParticipant: number[][] }
          >()
          for (let ch = 0; ch < channelDefs.length; ch++) {
            legacyMap.set(channelDefs[ch][0], {
              def: channelDefs[ch],
              perParticipant: eventBuffers[ch].map(buf => [...buf]),
            })
          }

          if (!stimulusMap.has(stimulusId)) {
            stimulusMap.set(stimulusId, new Map())
          }
          mergeIntoStimulusMap(stimulusMap, new Map([[stimulusId, legacyMap]]))
        }
      }
    }

    // --- Process CSV event files (no modal needed) ---
    const csvWarnings: string[] = []
    for (const file of csvFiles) {
      const text = await file.text()
      const { contributions, warnings: parseWarnings } =
        parseCsvEventText(text)
      csvWarnings.push(...parseWarnings.map(w => `${file.name}: ${w}`))

      const { stimulusMap: csvMap, warnings: resolveWarnings } =
        resolveContributionsForEngine(
          contributions,
          meta.stimuli.data,
          meta.participants.data,
          participantCount,
          meta.aois.data
        )
      csvWarnings.push(...resolveWarnings.map(w => `${file.name}: ${w}`))
      mergeIntoStimulusMap(stimulusMap, csvMap)
    }

    if (csvWarnings.length > 0) {
      this.deps.toastState.addWarning(
        `Event CSV: ${csvWarnings.length} warning${csvWarnings.length > 1 ? 's' : ''} (${csvWarnings.slice(0, 3).join('; ')}${csvWarnings.length > 3 ? '...' : ''})`
      )
    }

    // --- Build merged updates and apply ---
    const mergedUpdates: {
      stimulusId: number
      channelDefs: string[][]
      eventBuffers: number[][][]
    }[] = []

    for (const [stimulusId, channelMap] of stimulusMap) {
      const channelDefs: string[][] = []
      const eventBuffers: number[][][] = []
      for (const { def, perParticipant } of channelMap.values()) {
        channelDefs.push(def)
        eventBuffers.push(perParticipant)
      }
      mergedUpdates.push({ stimulusId, channelDefs, eventBuffers })
    }

    if (mergedUpdates.length === 0) {
      this.deps.toastState.addInfo('All event files were set to Ignore.')
      return
    }

    engine.updateEventDataBatch(mergedUpdates)
    // This mutation runs outside the command bus, after plots have already
    // derived from the freshly-reset grid — bump the redraw epoch or the
    // imported events stay invisible until an unrelated command fires.
    this.deps.grid.triggerRedraw()
    const totalProcessed =
      csvFiles.length + (legacyFiles.length > 0 ? legacyFiles.length : 0)
    this.deps.toastState.addSuccess(
      `${totalProcessed} event file${totalProcessed > 1 ? 's' : ''} processed successfully`
    )
  }
}
