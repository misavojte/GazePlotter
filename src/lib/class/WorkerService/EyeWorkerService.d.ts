import { AbstractWorkerService } from './AbstractWorkerService.ts';
import type { DataType } from '../../type/Data/DataType.ts';
export declare class EyeWorkerService extends AbstractWorkerService {
    onData: (data: DataType) => void;
    constructor(onData: (data: DataType) => void);
    /**
     * Sends the given files to the worker.
     * @param files - The files to send.
     */
    sendFiles(files: FileList): void;
    /**
     * Makes a test postMessage call to the worker to check if the browser supports transferable streams.
     * If the browser does not support transferable streams, runtimes will throw an error.
     * This method catches the error and returns false.
     *
     * @returns {boolean} - Whether the browser supports transferable streams.
     */
    isStreamTransferable(): boolean;
    processDataAsStream(files: FileList): void;
    processDataAsArrayBuffer(files: FileList): Promise<void>;
    protected handleMessage(event: MessageEvent): void;
    protected handleError(event: ErrorEvent): void;
}
