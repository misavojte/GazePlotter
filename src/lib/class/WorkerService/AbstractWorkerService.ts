/**
 * Encapsulates the details of worker creation, message sending, and termination.
 * It hides the lower-level API, providing a cleaner and more straightforward interface.
 *
 * @param {string} workerScript - The path to the worker script.
 */
export abstract class AbstractWorkerService {
  protected worker: Worker

  protected constructor (workerScriptUrl: URL) {
    this.worker = new Worker(workerScriptUrl, { type: 'module' })
    this.worker.onmessage = this.handleMessage.bind(this)
    this.worker.onerror = this.handleError.bind(this)
  }

  protected abstract handleMessage (event: MessageEvent): void

  protected abstract handleError (event: ErrorEvent): void

  terminate (): void {
    this.worker.terminate()
  }
}
