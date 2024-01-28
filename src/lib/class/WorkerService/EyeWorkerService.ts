import ModalContentTobiiParsingInput from '$lib/components/Modal/ModalContent/ModalContentTobiiParsingInput.svelte'
import { modalStore } from '$lib/stores/modalStore.ts'
import {
  addErrorToast,
  addInfoToast,
  toastStore,
} from '$lib/stores/toastStore.ts'
import type { DataType } from '$lib/type/Data/DataType.ts'

/**
 * Creates a worker to handle whole eyefiles processing.
 * It is a separate file to avoid blocking the main thread.
 *
 * Workers must be instantiated in a specific way to work with TypeScript modules in Vite:
 *    new Worker(new URL('path/to/typescriptWorker.ts', import.meta.url), { type: 'module' })
 */
export class EyeWorkerService {
  worker: Worker
  onData: (data: DataType) => void
  constructor(onData: (data: DataType) => void) {
    this.worker = new Worker(
      new URL('$lib/worker/eyePipelineWorker.ts', import.meta.url),
      {
        type: 'module',
      }
    )
    this.worker.onmessage = this.handleMessage.bind(this)
    this.worker.onerror = (event: ErrorEvent) => this.handleError(event)
    this.onData = onData
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
      const json = JSON.parse(reader.result as string) as DataType
      this.onData(json)
    }
    reader.readAsText(file)
  }

  protected handleMessage(event: MessageEvent): void {
    switch (event.data.type) {
      case 'done':
        this.onData(event.data.data)
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

  protected handleError(event: ErrorEvent): void {
    addErrorToast('Could not process the file')
    console.error(event.error)
    console.error('EyeWorkerService.handleError() - event:', event)
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
      modalStore.open(ModalContentTobiiParsingInput, 'Tobii Parsing Input', {
        valuePromiseResolve: resolve,
        valuePromiseReject: reject,
      })
    })
  }
}
