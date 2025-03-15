import { EyePipeline } from '$lib/class/Eye/EyePipeline/EyePipeline'

/**
 * A worker file handling whole eyefiles processing.
 * It is a separate file to avoid blocking the main thread.
 */

let fileNames: string[] = []
let pipeline: EyePipeline | null = null
let streams: ReadableStream[] = []
let userInputResolver: (value: string) => void

const isStringArray = (data: unknown): data is string[] => {
  if (!Array.isArray(data)) return false
  if (data.length === 0) return false
  return typeof data[0] === 'string'
}

const isReadableStream = (data: unknown): data is ReadableStream => {
  if (typeof data !== 'object') return false
  if (data === null) return false
  return typeof (data as ReadableStream).getReader === 'function'
}

const requestUserInput = (): Promise<string> => {
  self.postMessage({ type: 'request-user-input' })
  return new Promise(resolve => {
    userInputResolver = resolve
  })
}

self.onmessage = async e => await processEvent(e)

async function processEvent(e: MessageEvent): Promise<void> {
  const { data, type } = e.data
  try {
    switch (type) {
      case 'file-names':
        if (!isStringArray(data)) throw new Error('File names are not string[]')
        fileNames = data
        pipeline = new EyePipeline(fileNames, requestUserInput)
        return
      case 'test-stream':
        if (!isReadableStream(data))
          throw new Error('Stream is not ReadableStream')
        return
      case 'stream':
        return await evalStream(data)
      case 'buffer':
        return await evalBuffer(data)
      case 'user-input':
        return userInputResolver(data)
      default:
        throw new Error('Unknown const type in worker', data)
    }
  } catch (error) {
    console.error('Error in worker', error)
    self.postMessage({ type: 'fail', data: error })
  }
}

/**
 * Converts ArrayBuffer to ReadableStream and passes it to evalStream
 * @param buffer - The buffer to convert.
 */
const evalBuffer = async (buffer: ArrayBuffer): Promise<void> => {
  const chunkSize = 1024 * 1024
  const chunks = Math.ceil(buffer.byteLength / chunkSize)
  const stream = new ReadableStream({
    start(controller) {
      for (let i = 0; i < chunks; i++) {
        const start = i * chunkSize
        const end = Math.min(start + chunkSize, buffer.byteLength)
        controller.enqueue(new Uint8Array(buffer.slice(start, end)))
      }
      controller.close()
    },
  })
  await evalStream(stream)
}

/**
 * Adds a new stream to the pipeline and processes it if all streams are present.
 * @param rs - The stream to add.
 */
const evalStream = async (rs: ReadableStream): Promise<void> => {
  if (pipeline === null) throw new Error('Pipeline is not initialized')
  if (fileNames.length === 0) throw new Error('No files to process')
  streams.push(rs)
  // if have everything, process
  if (streams.length === fileNames.length) {
    for (const stream of streams) {
      const data = await pipeline.addNewStream(stream)
      if (data !== null) {
        console.log('Done', data)
        self.postMessage({ type: 'done', data })
        streams = []
        fileNames = []
      }
    }
  }
}
