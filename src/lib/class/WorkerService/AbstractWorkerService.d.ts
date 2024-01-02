/**
 * Encapsulates the details of worker creation, message sending, and termination.
 * It hides the lower-level API, providing a cleaner and more straightforward interface.
 *
 * @param {string} workerScript - The path to the worker script.
 */
export declare abstract class AbstractWorkerService {
    protected worker: Worker;
    protected constructor(workerScriptUrl: URL);
    protected abstract handleMessage(event: MessageEvent): void;
    protected abstract handleError(event: ErrorEvent): void;
    terminate(): void;
}
