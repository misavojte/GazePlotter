import { ModalContentTobiiParsingInput } from '$lib/modals'
import { modalStore } from '$lib/modals/shared/stores/modalStore'
import { addErrorToast, addInfoToast } from '$lib/toaster'
import type { DataType } from '$lib/type/Data'

/**
 * Creates a worker to handle whole eyefiles processing.
 * It is a separate file to avoid blocking the main thread.
 *
 * Workers must be instantiated in a specific way to work with TypeScript modules in Vite:
 *    new Worker(new URL('path/to/typescriptWorker', import.meta.url), { type: 'module' })
 */
export class EyeWorkerService {
  worker: Worker
  onData: (data: DataType) => void
  onFail: () => void
  constructor(onData: (data: DataType) => void, onFail: () => void) {
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
        // Parse the JSON file content
        let json = JSON.parse(reader.result as string) as DataType

        // Normalize the data structure to handle missing participants in stimuli
        json = this.normalizeDataStructure(json)

        // Validate segments and ensure consistency
        json = this.validateSegments(json)

        this.onData(json)
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

  /**
   * Normalizes the data structure to ensure all required fields exist
   * and the segments array is properly initialized for all stimuli and participants.
   *
   * This prevents errors when processing data where some participants
   * don't have data for all stimuli.
   *
   * @param data - The DataType object parsed from JSON
   * @returns The normalized DataType with complete structure
   */
  private normalizeDataStructure(data: DataType): DataType {
    // Create segments array if it doesn't exist
    if (!data.segments) {
      data.segments = []
    }

    // Get counts of stimuli and participants
    const stimuliCount = data.stimuli.data.length
    const participantsCount = data.participants.data.length

    // Ensure segments array has an entry for each stimulus
    while (data.segments.length < stimuliCount) {
      data.segments.push([])
    }

    // For each stimulus, ensure we have initialized participant arrays
    for (let stimulusIndex = 0; stimulusIndex < stimuliCount; stimulusIndex++) {
      const stimulusSegments = data.segments[stimulusIndex] || []
      data.segments[stimulusIndex] = stimulusSegments

      // Ensure each stimulus has entries for all participants (even if empty)
      while (stimulusSegments.length < participantsCount) {
        stimulusSegments.push([])
      }
    }

    return data
  }

  /**
   * Validates segment data to ensure consistency and prevent errors during rendering.
   * This addresses issues where segment IDs don't exist or segments are accessed incorrectly.
   *
   * @param data - The normalized DataType object
   * @returns The validated DataType with consistent segments
   */
  private validateSegments(data: DataType): DataType {
    // Process all stimuli
    for (
      let stimulusIndex = 0;
      stimulusIndex < data.segments.length;
      stimulusIndex++
    ) {
      const stimulusSegments = data.segments[stimulusIndex]

      // Process all participants for this stimulus
      for (
        let participantIndex = 0;
        participantIndex < stimulusSegments.length;
        participantIndex++
      ) {
        let segments = stimulusSegments[participantIndex]

        // If segments is null or undefined, initialize it as an empty array
        if (!segments) {
          segments = []
          stimulusSegments[participantIndex] = segments
          continue
        }

        // Filter out any invalid segments (must have at least 3 elements: start, end, category)
        segments = segments.filter(
          segment =>
            Array.isArray(segment) &&
            segment.length >= 3 &&
            typeof segment[0] === 'number' &&
            typeof segment[1] === 'number' &&
            typeof segment[2] === 'number'
        )

        // Sort segments by start time (important for ScarfPlot rendering)
        segments.sort((a, b) => a[0] - b[0])

        // Update the filtered and sorted segments
        stimulusSegments[participantIndex] = segments
      }
    }

    return data
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
