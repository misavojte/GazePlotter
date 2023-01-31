import { EyeTrackingParser } from '../EyeTrackingParser/EyeTrackingParser'

let parser: EyeTrackingParser | null = null

self.onmessage = (e) => processEvent(e)

function processEvent (e: MessageEvent): void {
  const data = e.data
  if (Array.isArray(data)) {
    // if all children strings, it is a list of file names
    if (data.every((x) => typeof x === 'string')) {
      parser = new EyeTrackingParser(data)
      return
    }
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
  throw new Error('Unknown data type in worker')
}

function processReadableStream (stream: ReadableStream): void {
  if (parser === null) throw new Error('Parser not initialized in worker')
  void parser.process(stream).then((data) => {
    if (data !== null) self.postMessage(data)
  })
}
