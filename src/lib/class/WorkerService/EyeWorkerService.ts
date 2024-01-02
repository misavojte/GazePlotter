import { AbstractWorkerService } from './AbstractWorkerService.ts'
import type { DataType } from '$lib/type/Data/DataType.ts'

export class EyeWorkerService extends AbstractWorkerService {
  onData: (data: DataType) => void
  constructor (onData: (data: DataType) => void) {
    super(new URL('../../worker/eyePipelineWorker.ts', import.meta.url))
    this.onData = onData
  }

  /**
   * Sends the given files to the worker.
   * @param files - The files to send.
   */
  sendFiles (files: FileList): void {
    const fileNames = []
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
  isStreamTransferable (): boolean {
    const stream = new ReadableStream({
      start (controller) {
        controller.enqueue(new Uint8Array([]))
        controller.close()
      }
    })
    try {
      this.worker.postMessage({ type: 'test-stream', data: stream }, [stream])
      return true
    } catch (error) {
      return false
    }
  }

  processDataAsStream (files: FileList): void {
    for (let index = 0; index < files.length; index++) {
      const stream = files[index].stream()
      this.worker.postMessage({ type: 'stream', data: stream }, [stream])
    }
  }

  async processDataAsArrayBuffer (files: FileList): Promise<void> {
    for (let index = 0; index < files.length; index++) {
      const buffer = await files[index].arrayBuffer()
      this.worker.postMessage({ type: 'buffer', data: buffer }, [buffer])
    }
  }

  protected handleMessage (event: MessageEvent): void {
    switch (event.data.type) {
      case 'done':
        this.onData(event.data.data)
        break
      case 'fail':
        this.handleError(event.data.data)
        break
      default:
        console.error('EyeWorkerService.handleMessage() - event:', event)
    }
  }

  protected handleError (event: ErrorEvent): void {
    console.log(event.error)
    console.error('EyeWorkerService.handleError() - event:', event)
  }
}
