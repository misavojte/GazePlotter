import { EyeTrackingParser } from '../EyeTrackingParser/EyeTrackingParser'

let parser: EyeTrackingParser | null = null
let streams: ReadableStream[] = []
let numberOfStreams = 0

self.onmessage = async (e) => await processEvent(e)

async function processEvent (e: MessageEvent): Promise<void> {
  const { data, type } = e.data
  switch (type) {
    case 'settings':
      parser = new EyeTrackingParser(data)
      numberOfStreams = data.fileNames.length
      return
    case 'test-stream':
      return
    case 'stream':
      return await evalStreams(data)
    case 'buffer':
      return await evalBuffer(data)
    default:
      throw new Error('Unknown data type in worker', data)
  }
}
async function evalBuffer (buffer: ArrayBuffer): Promise<void> {
  const stream = new ReadableStream({
    start (controller) {
      controller.enqueue(buffer)
      controller.close()
    }
  })
  return await evalStreams(stream)
}

async function evalStreams (stream: ReadableStream): Promise<void> {
  if (parser === null) throw new Error('Parser not initialized in worker')
  streams.push(stream)
  if (streams.length === numberOfStreams) {
    for (const stream of streams) {
      const response = await parser.process(stream)
      if (response !== null) {
        numberOfStreams = 0
        streams = []
        self.postMessage(response)
      }
    }
  }
}
