import { EyeTrackingParser } from '../EyeTrackingParser/EyeTrackingParser'
import { isWorkerSettingsMessage } from '../../Types/Parsing/WorkerSettingsMessage'

let parser: EyeTrackingParser | null = null
const streams: ReadableStream[] = []
let numberOfStreams = 0

self.onmessage = async (e) => await processEvent(e)

async function processEvent (e: MessageEvent): Promise<void> {
  const data = e.data
  if (isWorkerSettingsMessage(data)) {
    parser = new EyeTrackingParser(data)
    numberOfStreams = data.fileNames.length
    return
  }
  if (data.constructor.name === 'ReadableStream') {
    return await evalStreams(data)
  }
  if (data.constructor.name === 'ArrayBuffer') {
    const stream = new ReadableStream({
      start (controller) {
        controller.enqueue(data)
        controller.close()
      }
    })
    return await evalStreams(stream)
  }
  throw new Error('Unknown data type in worker', data)
}

async function evalStreams (stream: ReadableStream): Promise<void> {
  if (parser === null) throw new Error('Parser not initialized in worker')
  streams.push(stream)
  if (streams.length === numberOfStreams) {
    for (const stream of streams) {
      const response = await parser.process(stream)
      if (response !== null) {
        self.postMessage(response)
      }
    }
  }
}
