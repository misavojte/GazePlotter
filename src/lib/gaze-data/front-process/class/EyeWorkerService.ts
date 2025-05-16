import { ModalContentTobiiParsingInput } from '$lib/modals'
import { modalStore } from '$lib/modals/shared/stores/modalStore'
import { addErrorToast, addInfoToast } from '$lib/toaster'
import type { DataType } from '$lib/gaze-data/shared/types'
import { processJsonFileWithGrid } from '$lib/gaze-data/front-process/utils/jsonParsing'
import type { AllGridTypes } from '$lib/workspace/type/gridType'
/**
 * Creates a worker to handle whole eyefiles processing.
 * It is a separate file to avoid blocking the main thread.
 *
 * Workers must be instantiated in a specific way to work with TypeScript modules in Vite:
 *    new Worker(new URL('path/to/typescriptWorker', import.meta.url), { type: 'module' })
 */
export class EyeWorkerService {
  worker: Worker
  onData: (data: {
    data: DataType
    gridItems?: Array<Partial<AllGridTypes> & { type: string }>
  }) => void
  onFail: () => void
  constructor(
    onData: (data: {
      data: DataType
      gridItems?: Array<Partial<AllGridTypes> & { type: string }>
    }) => void,
    onFail: () => void
  ) {
    this.worker = new Worker(
      new URL(
        '$lib/gaze-data/back-process/worker/eyePipelineWorker.ts', // Must be a full path, not via index.ts
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
  }

  /**
   * Sends the given files to the worker.
   * @param files - The files to send.
   */
  sendFiles(files: FileList): void {
    const fileNames = []
    // check extension of first file
    const extension = files[0].name.split('.').pop()
    if (extension === 'json') return this.processJsonWorkspace(files[0])
    for (let index = 0; index < files.length; index++) {
      fileNames.push(files[index].name)
    }
    this.worker.postMessage({ type: 'file-names', data: fileNames })
    if (this.isStreamTransferable()) {
      this.processDataAsStream(files)
    } else {
      void this.processDataAsArrayBuffer(files)
    }
  }

  /**
   * Makes a test postMessage call to the worker to check if the browser supports transferable streams.
   * If the browser does not support transferable streams, runtimes will throw an error.
   * This method catches the error and returns false.
   *
   * @returns {boolean} - Whether the browser supports transferable streams.
   */
  isStreamTransferable(): boolean {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([]))
        controller.close()
      },
    })
    try {
      this.worker.postMessage({ type: 'test-stream', data: stream }, [stream])
      return true
    } catch (error) {
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

  processJsonWorkspace(file: File): void {
    addInfoToast(
      'Loading workspace from JSON file. GazePlotter accepts only JSON files exported from its environment'
    )
    addInfoToast('Only the first file will be loaded')
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const result = processJsonFileWithGrid(reader.result as string)
        this.onData(result)
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

  protected handleMessage(event: MessageEvent): void {
    switch (event.data.type) {
      case 'done':
        this.onData({ data: event.data.data }) // no grid items in this case! :)
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

  protected handleError(error: Error): void {
    const message = error?.message ?? 'Unknown error'
    addErrorToast('Could not process the file: ' + message)
    console.error('EyeWorkerService.handleError() - error:', error)
    this.onFail()
  }

  handleUserInputProcess(): void {
    this.requestUserInput()
      .then(userInput => {
        this.worker.postMessage({ type: 'user-input', data: userInput })
        modalStore.close()
      })
      .catch(() => {
        addInfoToast(
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
      modalStore.open(
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
