import { EyeTrackingParser } from '../EyeTrackingParser/EyeTrackingParser'
import { isWorkerSettingsMessage } from '../../Types/Parsing/WorkerSettingsMessage'

let parser: EyeTrackingParser | null = null

self.onmessage = (e) => processEvent(e)

function processEvent (e: MessageEvent): void {
  const data = e.data
  if (isWorkerSettingsMessage(data)) {
    parser = new EyeTrackingParser(data)
    return
  }
  if (data.constructor.name === 'ReadableStream') {
    return processReadableStream(data)
  }
  if (data.constructor.name === 'ArrayBuffer') {
    const stream = new ReadableStream({
      start (controller) {
        controller.enqueue(data)
        controller.close()
      }
    })
    return processReadableStream(stream)
  }
  throw new Error('Unknown data type in worker', data)
}

function processReadableStream (stream: ReadableStream): void {
  if (parser === null) throw new Error('Parser not initialized in worker')
  void parser.process(stream).then((data) => {
    if (data !== null) self.postMessage(data)
  })
}
