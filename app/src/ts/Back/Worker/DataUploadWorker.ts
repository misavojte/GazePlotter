import { EyeTrackingParser } from '../EyeTrackingParser/EyeTrackingParser'

const parser = new EyeTrackingParser()

self.onmessage = (e) => processEvent(e)

function processEvent (e: MessageEvent): void {
  const data = e.data
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
  if (typeof data === 'number') {
    parser.filesToParse = data
  }
}

function processReadableStream (stream: ReadableStream): void {
  void parser.process(stream).then((data) => {
    if (data !== null) self.postMessage(data)
  })
}
