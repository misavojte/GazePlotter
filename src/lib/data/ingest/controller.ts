import { ModalContentTobiiParsingInput } from '$lib/modals'
import type { DataType, ParsedData } from '$lib/data/types'
import { processJsonFileWithGrid } from './workspace/parser'
import type { EyeSettingsType } from '$lib/data/ingest/types'
import type {
  FileMetadataSuccessType,
  FileMetadataFailureType,
} from '$lib/workspace/type/fileMetadataType'
import { DEFAULT_GRID_STATE_DATA } from '$lib/workspace'
import { formatDuration } from '$lib/shared/utils/timeUtils'
import { formatFileSize } from '$lib/shared/utils/fileUtils'
import type { ModalState } from '$lib/modals/modal.state.svelte'
import type { ToastState } from '$lib/toaster/toastState.svelte'

type IngestUiServices = {
  modalState: Pick<ModalState, 'open' | 'close'>
  toastState: Pick<ToastState, 'addError' | 'addInfo' | 'addSuccess'>
}

/**
 * Formats file information for display in success messages
 */
function formatFileInfo(fileNames: string[], fileSizes: number[]): string {
  if (fileNames.length === 0) return ''

  if (fileNames.length === 1) {
    return `${fileNames[0]} (${formatFileSize(fileSizes[0])})`
  }

  const totalSize = fileSizes.reduce((sum, size) => sum + size, 0)
  const fileCount = fileNames.length

  // For multiple files, show count and total size, plus first few file names
  let fileInfo = `${fileCount} files (${formatFileSize(totalSize)})`

  // Add file names, but limit to avoid overly long messages
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
 * Creates a worker to handle whole eyefiles processing.
 * It is a separate file to avoid blocking the main thread.
 *
 * Workers must be instantiated in a specific way to work with TypeScript modules in Vite:
 *    new Worker(new URL('path/to/typescriptWorker', import.meta.url), { type: 'module' })
 */
export class EyeWorkerService {
  worker: Worker
  parsingSumTime: number = 0 // in seconds
  parsingAnchorTime: number = 0 // in UNIX timestamp
  fileNames: string[] = []
  fileSizes: number[] = [] // in bytes
  onData: (data: ParsedData) => void
  onFail: (failureMetadata: FileMetadataFailureType) => void
  ui: IngestUiServices
  constructor(
    onData: (data: ParsedData) => void,
    onFail: (failureMetadata: FileMetadataFailureType) => void,
    ui: IngestUiServices
  ) {
    this.worker = new Worker(
      new URL(
        '$lib/data/ingest/worker.ts', // Must be a full path, not via index.ts
        import.meta.url
      ),
      {
        type: 'module',
      }
    )
    this.worker.onmessage = this.handleMessage.bind(this)
    this.worker.onerror = (event: ErrorEvent) => this.handleError(event.error)
    this.onData = onData
    this.onFail = onFail
    this.ui = ui
  }

  /**
   * Sends the given files to the worker.
   * @param files - The files to send.
   */
  sendFiles(files: FileList): void {
    const fileArray = Array.from(files)
    this.fileNames = fileArray.map(f => f.name)
    this.fileSizes = fileArray.map(f => f.size)
    this.parsingSumTime = 0
    this.parsingAnchorTime = Date.now()

    const firstFile = fileArray[0]
    const parts = firstFile.name.split('.')
    const extension = parts.length > 1 ? parts.pop()?.toLowerCase() : undefined

    if (extension === 'json') {
      return this.processJsonWorkspace(firstFile)
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

  /**
   * Cached result of transferable stream support check.
   */
  private static _isStreamTransferableCached: boolean | null = null

  /**
   * Makes a test postMessage call to the worker to check if the browser supports transferable streams.
   * If the browser does not support transferable streams, runtimes will throw an error.
   * This method catches the error and returns false.
   *
   * @returns {boolean} - Whether the browser supports transferable streams.
   */
  isStreamTransferable(): boolean {
    if (EyeWorkerService._isStreamTransferableCached !== null) {
      return EyeWorkerService._isStreamTransferableCached
    }

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([]))
        controller.close()
      },
    })
    try {
      this.worker.postMessage({ type: 'test-stream', data: stream }, [stream])
      EyeWorkerService._isStreamTransferableCached = true
      return true
    } catch (error) {
      EyeWorkerService._isStreamTransferableCached = false
      return false
    }
  }

  processDataAsStream(files: FileList): void {
    for (let index = 0; index < files.length; index++) {
      const stream = files[index].stream()
      this.worker.postMessage({ type: 'stream', data: stream }, [stream])
    }
  }

  async processDataAsArrayBuffer(files: FileList): Promise<void> {
    for (let index = 0; index < files.length; index++) {
      const buffer = await files[index].arrayBuffer()
      this.worker.postMessage({ type: 'buffer', data: buffer }, [buffer])
    }
  }

  async processZipFiles(files: FileList): Promise<void> {
    // Convert FileList to array immediately to avoid issues with FileList becoming invalid
    const fileArray = Array.from(files)
    const totalFiles = fileArray.length
    console.log(`[Service] Processing ${totalFiles} ZIP files`)

    for (let index = 0; index < totalFiles; index++) {
      const file = fileArray[index]
      if (!file) {
        throw new Error(`File at index ${index} is undefined`)
      }
      console.log(
        `[Service] Reading buffer for file ${index + 1}/${totalFiles}: ${this.fileNames[index]}`
      )
      const buffer = await file.arrayBuffer()
      const zipName = this.fileNames[index] // Use the stored file name
      console.log(
        `[Service] Sending ZIP buffer ${index + 1}/${totalFiles}, size: ${buffer.byteLength} bytes`
      )
      this.worker.postMessage(
        { type: 'zip-buffer', data: { buffer, zipName } },
        [buffer as ArrayBuffer]
      )
      console.log(`[Service] Sent ZIP buffer ${index + 1}/${totalFiles}`)
    }
    console.log(`[Service] All ${totalFiles} ZIP files sent to worker`)
  }

  processJsonWorkspace(file: File): void {
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
        // Handle any errors during parsing or processing
        this.handleError(
          error instanceof Error
            ? error
            : new Error('Failed to parse JSON file')
        )
      }
    }
    reader.onerror = () => {
      // Handle file reading errors
      this.handleError(new Error('Failed to read JSON file'))
    }
    reader.readAsText(file)
  }

  protected handleData({
    data,
    classified,
  }: {
    data: DataType
    classified: EyeSettingsType
  }): void {
    const parseDuration =
      Date.now() - this.parsingAnchorTime + this.parsingSumTime
    const userAgent = navigator.userAgent
    const gazePlotterVersion = __APP_VERSION__
    const fileMetadata: FileMetadataSuccessType = {
      status: 'success',
      fileNames: this.fileNames,
      fileSizes: this.fileSizes,
      parseSettings: classified,
      parseDate: new Date().toISOString(),
      parseDuration: parseDuration,
      gazePlotterVersion: gazePlotterVersion,
      clientUserAgent: userAgent,
    }
    const timeString = formatDuration(parseDuration)
    const formattedFileInfo = formatFileInfo(this.fileNames, this.fileSizes)
    this.ui.toastState.addSuccess(
      `${formattedFileInfo} parsed successfully in ${timeString}`
    )
    this.onData({
      data: data,
      fileMetadata: fileMetadata,
      version: 3,
      gridItems: DEFAULT_GRID_STATE_DATA,
      current: {
        fileNames: this.fileNames,
        fileSizes: this.fileSizes,
        parseDate: new Date().toISOString(),
      },
    } as ParsedData)
  }

  protected handleMessage(event: MessageEvent): void {
    switch (event.data.type) {
      case 'done':
        this.handleData({
          data: event.data.data,
          classified: event.data.classified,
        }) // no grid items in this case! :)
        break
      case 'fail':
        this.handleError(event.data.data)
        break
      case 'request-user-input':
        this.handleUserInputProcess()
        break
      default:
        console.error('EyeWorkerService.handleMessage() - event:', event)
    }
  }

  /**
   * Handles errors during file processing and creates failure metadata.
   * Captures error details, file information, and partial timing if available.
   *
   * @param error - The error that occurred during processing
   */
  protected handleError(error: Error): void {
    const message = error?.message ?? 'Unknown error'
    this.ui.toastState.addError('Could not process the file: ' + message)
    console.error('EyeWorkerService.handleError() - error:', error)

    // Calculate partial parsing duration if we have timing information
    const attemptedParseDuration =
      this.parsingAnchorTime > 0
        ? Date.now() - this.parsingAnchorTime + this.parsingSumTime
        : undefined

    // Create failure metadata with all available information
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

  /**
   * Handles the user input process when the worker requests additional information.
   *
   * This method pauses the duration calculation while waiting for user input to ensure
   * accurate parsing time measurement. The time spent waiting for user interaction
   * is not included in the final parsing duration.
   *
   * Process flow:
   * 1. Pauses duration tracking by accumulating elapsed time in parsingSumTime
   * 2. Requests user input via modal (typically for Tobii parsing configuration)
   * 3. On success: resumes duration tracking and sends input to worker
   * 4. On failure: provides default behavior and continues processing
   *
   * @returns {void}
   */
  handleUserInputProcess(): void {
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

  /**
   * Requests user input for further processing,
   * to determine how to parse stimuli in the file.
   *
   * The user input is then sent to the worker which resumes processing.
   */
  requestUserInput(): Promise<string> {
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
