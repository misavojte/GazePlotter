import { tobiiParsingInputModal } from '$lib/modals/definitions'
import { eventFileMappingModal } from '$lib/modals/import/definitions'
import {
  isTobiiJson,
  processAoiVisibilityFromText,
  buildEventChannelsFromParsed,
} from '$lib/modals/import/shared/aoiVisibilityServices'
import {
  isCsvEventFile,
  parseCsvEventText,
  buildEventDataFromCsvRows,
  mergeIntoStimulusMap,
} from '$lib/modals/import/shared/csvEventParser'
import { getStimuliOptions, getParticipantOptions } from '$lib/plots/shared'
import { getStimulusHighestEndTime } from '$lib/data/engine'
import { processJsonFileWithGrid } from './workspace/parser'
import { DEFAULT_GRID_STATE_DATA } from '$lib/workspace'
import type { ErrorService } from '$lib/errors'
import { formatDuration } from '$lib/shared/utils/timeUtils'
import { formatFileSize } from '$lib/shared/utils/fileUtils'
import type { DataType, ParsedData } from '$lib/data/types'
import type {
  EyeSettingsType,
  FileInputType,
  FileMetadataFailureType,
  FileMetadataSuccessType,
  FileMetadataType,
} from '$lib/data/ingest'
import type { ModalState } from '$lib/modals/modal.state.svelte'
import type { ToastState } from '$lib/toaster/toastState.svelte'
import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import type { GridState } from '$lib/workspace/grid/store.svelte'
import type { GridItemSnapshot } from '$lib/workspace'

export type IngestStatus = 'loading' | 'ready' | 'error'

type IngestUiServices = {
  errorService: Pick<ErrorService, 'report'>
  modalState: Pick<ModalState, 'open' | 'close'>
  toastState: Pick<ToastState, 'addInfo' | 'addSuccess'>
}

type IngestDependencies = {
  engine: DataEngine
  errorService: ErrorService
  grid: GridState
  modalState: ModalState
  toastState: ToastState
  resetWorkspaceHistory: () => void
}

const EMPTY_DATASET: DataType = {
  isOrdinalOnly: false,
  stimuli: { data: [], orderVector: [] },
  participants: { data: [], orderVector: [] },
  participantsGroups: [],
  categories: { data: [], orderVector: [] },
  noAoiTreatment: {
    color: '#cbd5e1',
    displayedName: 'No AOI',
  },
  aois: {
    data: [],
    orderVector: [],
    hiddenAois: [],
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
    hiddenChannels: [],
    events: [],
  },
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

/**
 * Separates uploaded files into eye-tracking data files and event files.
 * .xml → event file; .json with Tobii AOI structure → event file;
 * .csv with event columns → event file; rest → eye-tracking.
 */
async function separateEventFiles(
  files: File[]
): Promise<{ eyeFiles: File[]; eventFiles: File[] }> {
  const eyeFiles: File[] = []
  const eventFiles: File[] = []
  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'xml') {
      eventFiles.push(file)
    } else if (ext === 'json' && files.length > 1) {
      // Multi-file upload: check if a JSON file is a Tobii event file
      const text = await file.text()
      try {
        const json = JSON.parse(text)
        if (isTobiiJson(json)) {
          eventFiles.push(file)
        } else {
          eyeFiles.push(file)
        }
      } catch {
        eyeFiles.push(file)
      }
    } else if (ext === 'csv') {
      try {
        if (await isCsvEventFile(file)) {
          eventFiles.push(file)
          continue
        }
      } catch {
        // Fall through to eye-tracking
      }
      eyeFiles.push(file)
    } else {
      eyeFiles.push(file)
    }
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

    const firstFile = fileArray[0]
    const parts = firstFile.name.split('.')
    const extension = parts.length > 1 ? parts.pop()?.toLowerCase() : undefined

    if (extension === 'json') {
      this.processJsonWorkspace(firstFile)
      return
    }

    if (
      !this.postWorkerMessage(
        { type: 'file-names', data: this.fileNames },
        [],
        { stage: 'initialize-worker' }
      )
    ) {
      return
    }

    if (extension === 'zip') {
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

  private processJsonWorkspace(file: File): void {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const result = processJsonFileWithGrid(reader.result as string)
        this.onProgress(100)
        const timeString = formatDuration(
          Date.now() - this.parsingAnchorTime + this.parsingSumTime
        )
        const formattedFileInfo = formatFileInfo([file.name], [file.size])
        this.ui.toastState.addSuccess(
          `${formattedFileInfo} workspace loaded successfully in ${timeString}`
        )
        if (!this.markSettled()) return

        this.onData({
          ...result,
          current: {
            fileNames: [file.name],
            fileSizes: [file.size],
            parseDate: new Date().toISOString(),
          },
        })
      } catch (error) {
        this.handleError(
          error instanceof Error
            ? error
            : new Error('Failed to parse JSON file')
        )
      }
    }
    reader.onerror = () => {
      this.handleError(new Error('Failed to read JSON file'))
    }
    reader.readAsText(file)
  }

  private handleData({
    data,
    classified,
  }: {
    data: DataType
    classified: EyeSettingsType
  }): void {
    const parseDuration =
      Date.now() - this.parsingAnchorTime + this.parsingSumTime
    const fileMetadata: FileMetadataSuccessType = {
      status: 'success',
      fileNames: this.fileNames,
      fileSizes: this.fileSizes,
      parseSettings: classified,
      parseDate: new Date().toISOString(),
      parseDuration,
      gazePlotterVersion: __APP_VERSION__,
      clientUserAgent: navigator.userAgent,
    }
    const timeString = formatDuration(parseDuration)
    const formattedFileInfo = formatFileInfo(this.fileNames, this.fileSizes)
    this.onProgress(100)
    this.ui.toastState.addSuccess(
      `${formattedFileInfo} parsed successfully in ${timeString}`
    )

    if (!this.markSettled()) return

    this.onData({
      data,
      fileMetadata,
      version: 4,
      gridItems: DEFAULT_GRID_STATE_DATA,
      current: {
        fileNames: this.fileNames,
        fileSizes: this.fileSizes,
        parseDate: new Date().toISOString(),
      },
    } as ParsedData)
  }

  private handleMessage(event: MessageEvent): void {
    switch (event.data.type) {
      case 'progress':
        this.handleProgress(event.data.processedBytes)
        break
      case 'done':
        this.handleData({
          data: event.data.data,
          classified: event.data.classified,
        })
        break
      case 'fail':
        this.handleError(event.data.data)
        break
      case 'request-user-input':
        this.handleUserInputProcess()
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
      gazePlotterVersion: __APP_VERSION__,
      clientUserAgent: navigator.userAgent,
    } satisfies FileMetadataFailureType

    this.onFail(failureMetadata)
  }

  private handleUserInputProcess(): void {
    this.parsingSumTime += Date.now() - this.parsingAnchorTime
    this.requestUserInput()
      .then(userInput => {
        this.parsingAnchorTime = Date.now()
        if (
          !this.postWorkerMessage({ type: 'user-input', data: userInput }, [], {
            stage: 'dispatch-user-input',
          })
        ) {
          this.ui.modalState.close()
          return
        }
        this.ui.modalState.close()
      })
      .catch(error => {
        this.handleError(error, { stage: 'request-user-input' })
      })
  }

  private requestUserInput(): Promise<string> {
    return this.ui.modalState.open(tobiiParsingInputModal, {}).then(value => {
      if (value !== null) {
        return value
      }

      this.ui.toastState.addInfo(
        'User input was not provided. The file will be processed as Tobii without events'
      )
      return ''
    })
  }
}

export class IngestService {
  status = $state<IngestStatus>('loading')
  metadata = $state<FileMetadataType | null>(null)
  input = $state<FileInputType | null>(null)
  progressPercent = $state(0)

  isLoading = $derived(this.status === 'loading')

  constructor(private readonly deps: IngestDependencies) {}

  async loadFiles(files: FileList): Promise<boolean> {
    if (files.length === 0) return false

    this.deps.errorService.clearAll()
    this.status = 'loading'
    this.progressPercent = 0

    try {
      const allFiles = Array.from(files)
      const { eyeFiles, eventFiles } = await separateEventFiles(allFiles)

      if (eyeFiles.length === 0 && eventFiles.length > 0) {
        this.deps.errorService.report({
          origin: 'ingest',
          severity: 'fatal-load',
          userMessage:
            'Only event files were uploaded. Please include eye-tracking data files together with event files.',
          cause: new Error('No eye-tracking data files found'),
          context: {
            eventFileCount: eventFiles.length,
            eventFileNames: eventFiles.map(f => f.name),
          },
        })
        this.status = 'error'
        return false
      }

      return await new Promise<boolean>((resolve, reject) => {
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
                    eventFileNames: eventFiles.map(f => f.name),
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
      this.status = 'error'
      return false
    }
  }

  applyParsedData(parsedData: ParsedData): void {
    this.deps.errorService.clearFatalLoad()
    this.progressPercent = 100
    this.metadata =
      parsedData.version >= 3 ? parsedData.fileMetadata ?? null : null
    this.input = parsedData.current
    this.deps.engine.loadDataset(parsedData.data)
    this.deps.grid.reset(
      (parsedData.gridItems ?? DEFAULT_GRID_STATE_DATA) as GridItemSnapshot[]
    )
    this.deps.resetWorkspaceHistory()
    this.status = 'ready'
  }

  applyFailure(failureMetadata: FileMetadataFailureType): void {
    this.progressPercent = 0
    this.deps.grid.reset([])
    this.metadata = failureMetadata
    this.input = {
      fileNames: failureMetadata.fileNames,
      fileSizes: failureMetadata.fileSizes,
      parseDate: failureMetadata.parseDate,
    }
    this.deps.engine.loadDataset(EMPTY_DATASET)
    this.deps.resetWorkspaceHistory()
    this.status = 'error'
  }

  private async processEventFilesPostLoad(eventFiles: File[]): Promise<void> {
    const engine = this.deps.engine
    const meta = engine.metadata
    if (!meta) return

    const participantCount = meta.participants.data.length

    // Partition into CSV event files vs legacy (XML/JSON) event files
    const csvFiles: File[] = []
    const legacyFiles: File[] = []
    for (const file of eventFiles) {
      if (await isCsvEventFile(file)) {
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
          mergeIntoStimulusMap(
            stimulusMap,
            new Map([[stimulusId, legacyMap]])
          )
        }
      }
    }

    // --- Process CSV event files (no modal needed) ---
    const csvWarnings: string[] = []
    for (const file of csvFiles) {
      const text = await file.text()
      const { rows, warnings: parseWarnings } = parseCsvEventText(text)
      csvWarnings.push(...parseWarnings.map(w => `${file.name}: ${w}`))

      const { stimulusMap: csvMap, warnings: resolveWarnings } =
        buildEventDataFromCsvRows(
          rows,
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
    const totalProcessed =
      csvFiles.length +
      (legacyFiles.length > 0
        ? legacyFiles.length
        : 0)
    this.deps.toastState.addSuccess(
      `${totalProcessed} event file${totalProcessed > 1 ? 's' : ''} processed successfully`
    )
  }
}
