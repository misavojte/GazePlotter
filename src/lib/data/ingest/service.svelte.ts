import { ModalContentTobiiParsingInput } from '$lib/modals'
import { processJsonFileWithGrid } from './workspace/parser'
import { DEFAULT_GRID_STATE_DATA } from '$lib/workspace'
import { formatDuration } from '$lib/shared/utils/timeUtils'
import { formatFileSize } from '$lib/shared/utils/fileUtils'
import type { DataType, ParsedData } from '$lib/data/types'
import type { EyeSettingsType } from '$lib/data/ingest/types'
import type {
  FileInputType,
  FileMetadataFailureType,
  FileMetadataSuccessType,
  FileMetadataType,
} from '$lib/workspace/type/fileMetadataType'
import type { ModalState } from '$lib/modals/modal.state.svelte'
import type { ToastState } from '$lib/toaster/toastState.svelte'
import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import type { GridState } from '$lib/workspace/grid/store.svelte'
import type { AllGridTypes } from '$lib/workspace/type/gridType'

export type IngestStatus = 'loading' | 'ready' | 'error'

type IngestUiServices = {
  modalState: Pick<ModalState, 'open' | 'close'>
  toastState: Pick<ToastState, 'addError' | 'addInfo' | 'addSuccess'>
}

type IngestDependencies = {
  engine: DataEngine
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
    dynamicVisibility: {},
    hiddenAois: [],
  },
  segments: {
    segmentBuffer: new Float32Array(0),
    indexTable: new Uint32Array(0),
    aoiPool: new Uint16Array(0),
    maxParticipants: 0,
    stimuliCount: 0,
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

class IngestWorkerClient {
  private worker: Worker
  private parsingSumTime = 0
  private parsingAnchorTime = 0
  private fileNames: string[] = []
  private fileSizes: number[] = []

  constructor(
    private readonly onData: (data: ParsedData) => void,
    private readonly onFail: (failureMetadata: FileMetadataFailureType) => void,
    private readonly ui: IngestUiServices
  ) {
    this.worker = new Worker(
      new URL('$lib/data/ingest/worker.ts', import.meta.url),
      { type: 'module' }
    )
    this.worker.onmessage = this.handleMessage.bind(this)
    this.worker.onerror = (event: ErrorEvent) => this.handleError(event.error)
  }

  sendFiles(files: FileList): void {
    const fileArray = Array.from(files)
    this.fileNames = fileArray.map(file => file.name)
    this.fileSizes = fileArray.map(file => file.size)
    this.parsingSumTime = 0
    this.parsingAnchorTime = Date.now()

    const firstFile = fileArray[0]
    const parts = firstFile.name.split('.')
    const extension = parts.length > 1 ? parts.pop()?.toLowerCase() : undefined

    if (extension === 'json') {
      this.processJsonWorkspace(firstFile)
      return
    }

    this.worker.postMessage({ type: 'file-names', data: this.fileNames })

    if (extension === 'zip') {
      void this.processZipFiles(files)
    } else if (this.isStreamTransferable()) {
      this.processDataAsStream(files)
    } else {
      void this.processDataAsArrayBuffer(files)
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

  private processDataAsStream(files: FileList): void {
    for (let index = 0; index < files.length; index++) {
      const stream = files[index].stream()
      this.worker.postMessage({ type: 'stream', data: stream }, [stream])
    }
  }

  private async processDataAsArrayBuffer(files: FileList): Promise<void> {
    for (let index = 0; index < files.length; index++) {
      const buffer = await files[index].arrayBuffer()
      this.worker.postMessage({ type: 'buffer', data: buffer }, [buffer])
    }
  }

  private async processZipFiles(files: FileList): Promise<void> {
    const fileArray = Array.from(files)

    for (let index = 0; index < fileArray.length; index++) {
      const file = fileArray[index]
      const buffer = await file.arrayBuffer()
      const zipName = this.fileNames[index]
      this.worker.postMessage(
        { type: 'zip-buffer', data: { buffer, zipName } },
        [buffer as ArrayBuffer]
      )
    }
  }

  private processJsonWorkspace(file: File): void {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const result = processJsonFileWithGrid(reader.result as string)
        const timeString = formatDuration(
          Date.now() - this.parsingAnchorTime + this.parsingSumTime
        )
        const formattedFileInfo = formatFileInfo([file.name], [file.size])
        this.ui.toastState.addSuccess(
          `${formattedFileInfo} workspace loaded successfully in ${timeString}`
        )
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
    this.ui.toastState.addSuccess(
      `${formattedFileInfo} parsed successfully in ${timeString}`
    )
    this.onData({
      data,
      fileMetadata,
      version: 3,
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
      default:
        console.error('IngestWorkerClient.handleMessage() - event:', event)
    }
  }

  private handleError(error: Error): void {
    const message = error?.message ?? 'Unknown error'
    this.ui.toastState.addError(`Could not process the file: ${message}`)
    console.error('IngestWorkerClient.handleError() - error:', error)

    const attemptedParseDuration =
      this.parsingAnchorTime > 0
        ? Date.now() - this.parsingAnchorTime + this.parsingSumTime
        : undefined

    const failureMetadata: FileMetadataFailureType = {
      status: 'failure',
      fileNames: this.fileNames.length > 0 ? this.fileNames : ['Unknown file'],
      fileSizes: this.fileSizes,
      parseDate: new Date().toISOString(),
      errorMessage: message,
      errorStack: error?.stack,
      attemptedParseDuration,
      gazePlotterVersion: __APP_VERSION__,
      clientUserAgent: navigator.userAgent,
    }

    this.onFail(failureMetadata)
  }

  private handleUserInputProcess(): void {
    this.parsingSumTime += Date.now() - this.parsingAnchorTime
    this.requestUserInput()
      .then(userInput => {
        this.parsingAnchorTime = Date.now()
        this.worker.postMessage({ type: 'user-input', data: userInput })
        this.ui.modalState.close()
      })
      .catch(() => {
        this.ui.toastState.addInfo(
          'User input was not provided. The file will be processed as Tobii without events'
        )
        this.worker.postMessage({ type: 'user-input', data: '' })
      })
  }

  private requestUserInput(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.ui.modalState.open(
        ModalContentTobiiParsingInput as any,
        'Tobii Parsing Input',
        {
          valuePromiseResolve: resolve,
          valuePromiseReject: reject,
        }
      )
    })
  }
}

export class IngestService {
  status = $state<IngestStatus>('loading')
  metadata = $state<FileMetadataType | null>(null)
  input = $state<FileInputType | null>(null)

  isLoading = $derived(this.status === 'loading')
  hasError = $derived(this.status === 'error')

  constructor(private readonly deps: IngestDependencies) {}

  async loadFiles(files: FileList): Promise<void> {
    if (files.length === 0) return

    this.status = 'loading'

    try {
      await new Promise<void>((resolve, reject) => {
        const client = new IngestWorkerClient(
          data => {
            this.applyParsedData(data)
            resolve()
          },
          failureMetadata => {
            this.applyFailure(failureMetadata)
            reject(new Error(failureMetadata.errorMessage))
          },
          {
            modalState: this.deps.modalState,
            toastState: this.deps.toastState,
          }
        )
        client.sendFiles(files)
      })
    } catch (error) {
      console.error('IngestService.loadFiles() - error:', error)
      if (!this.hasError) {
        this.deps.toastState.addError('Unable to set up file processing service')
        this.status = 'error'
      }
      throw error
    }
  }

  applyParsedData(parsedData: ParsedData): void {
    this.metadata = parsedData.version === 3 ? parsedData.fileMetadata : null
    this.input = parsedData.current
    this.deps.engine.loadDataset(parsedData.data)
    this.deps.grid.reset(
      (parsedData.gridItems ?? DEFAULT_GRID_STATE_DATA) as Array<
        Partial<AllGridTypes> & { type: string }
      >
    )
    this.deps.resetWorkspaceHistory()
    this.status = 'ready'
  }

  applyFailure(failureMetadata: FileMetadataFailureType): void {
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
}
