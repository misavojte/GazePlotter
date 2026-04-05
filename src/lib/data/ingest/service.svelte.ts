import { tobiiParsingInputModal } from '$lib/modals/definitions'
import {
  eventFileMappingModal,
  type EventFileMapping,
} from '$lib/modals/import/definitions'
import {
  isTobiiJson,
  processAoiVisibilityFromText,
  buildEventChannelsFromParsed,
} from '$lib/modals/import/shared/aoiVisibilityServices'
import { BinaryBufferReader } from '$lib/data/binary/reader.segment'
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
 * .xml → event file; .json with Tobii AOI structure → event file; rest → eye-tracking.
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
    } else {
      eyeFiles.push(file)
    }
  }
  return { eyeFiles, eventFiles }
}

/**
 * Compute per-stimulus highest participant end time from raw segment buffers.
 */
function computeHighestEndTimes(data: DataType): number[] {
  const reader = new BinaryBufferReader(data.segments)
  const stimuliCount = data.stimuli.data.length
  const participantCount = data.participants.data.length
  const result: number[] = []
  for (let s = 0; s < stimuliCount; s++) {
    let max = 0
    for (let p = 0; p < participantCount; p++) {
      const end = reader.getParticipantEndTime(s, p)
      if (end > max) max = end
    }
    result.push(max)
  }
  return result
}

/**
 * Merge parsed event channels into DataType.eventData for a given stimulus.
 */
function mergeEventDataForStimulus(
  data: DataType,
  stimulusId: number,
  participantId: number | null,
  parsed: {
    multipleAoiNames: string[]
    multipleAoiVisibilityArrays: number[][]
  }
): void {
  const participantCount = data.participants.data.length
  const aoiData = data.aois.data[stimulusId]
  const { channelDefs, eventBuffers } = buildEventChannelsFromParsed(
    parsed,
    participantId,
    participantCount,
    aoiData
  )

  const ed = data.eventData
  for (let i = 0; i < channelDefs.length; i++) {
    const chIdx = ed.data[stimulusId].length
    ed.data[stimulusId].push(channelDefs[i])
    ed.events[stimulusId].push(eventBuffers[i])
    ed.orderVector[stimulusId].push(chIdx)
  }
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
            try {
              if (eventFiles.length > 0) {
                await this.processEventFilesIntoData(data, eventFiles)
              }
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
            this.applyParsedData(data)
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

  private async processEventFilesIntoData(
    parsedData: ParsedData,
    eventFiles: File[]
  ): Promise<void> {
    const data = parsedData.data
    const stimuliNames = data.stimuli.data.map(s => s[1])
    const participantNames = data.participants.data.map(p => p[1])

    const mapping = await this.deps.modalState.open(eventFileMappingModal, {
      fileNames: eventFiles.map(f => f.name),
      stimuliOptions: stimuliNames.map((name, i) => ({
        label: name,
        value: String(i),
      })),
      participantOptions: participantNames.map((name, i) => ({
        label: name,
        value: String(i),
      })),
    })

    if (!mapping) {
      this.deps.toastState.addInfo(
        'Event file mapping was cancelled. Data loaded without events.'
      )
      return
    }

    const highestEndTimes = computeHighestEndTimes(data)

    for (let i = 0; i < eventFiles.length; i++) {
      const { stimulusId, participantId } = mapping[i]
      const text = await eventFiles[i].text()
      const parsed = processAoiVisibilityFromText(
        text,
        highestEndTimes[stimulusId] ?? 0
      )
      mergeEventDataForStimulus(data, stimulusId, participantId, parsed)
    }

    this.deps.toastState.addSuccess(
      `${eventFiles.length} event file${eventFiles.length > 1 ? 's' : ''} processed successfully`
    )
  }
}
