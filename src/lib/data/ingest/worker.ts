import { IngestJob } from './kernel/job'
import type { IngestContext } from './kernel/context'
import type { IngestResult } from './kernel/result'
import { bufferSource, streamSource } from './kernel/source'
import { FORMAT_REGISTRY } from './formats/registry'

/**
 * Worker message bridge — the ONLY code that knows about postMessage.
 * Translates inbound file messages into `IngestSource`s for one
 * `IngestJob`, and the job's callbacks into outbound messages.
 *
 * Inbound:  'file-names' | 'test-stream' | 'stream' | 'buffer' |
 *           'zip-buffer' | 'prompt-response'
 * Outbound: 'progress' { processedBytes }
 *           'prompt'   { promptId, payload }
 *           'done'     { result: IngestResult }  (binary buffers transferred)
 *           'fail'     { data: Error }
 */

let job: IngestJob | null = null
let fileNames: string[] = []
let nextSourceIndex = 0
let promptResolver: ((value: string) => void) | null = null
let processedBytes = 0
let lastProgressMessageAt = 0

const PROGRESS_MESSAGE_INTERVAL_MS = 200

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

const postProgressMessage = (force = false): void => {
  const now = Date.now()
  if (!force && now - lastProgressMessageAt < PROGRESS_MESSAGE_INTERVAL_MS) {
    return
  }

  lastProgressMessageAt = now
  self.postMessage({ type: 'progress', processedBytes })
}

const ctx: IngestContext = {
  prompt(promptId, payload) {
    self.postMessage({ type: 'prompt', promptId, payload })
    return new Promise<string>(resolve => {
      promptResolver = resolve
    })
  },
  reportBytes(byteLength, force = false) {
    if (!Number.isFinite(byteLength) || byteLength <= 0) return
    processedBytes += byteLength
    postProgressMessage(force)
  },
}

const nextSourceName = (): string => {
  const name = fileNames[nextSourceIndex]
  if (name === undefined) throw new Error('File name is undefined')
  nextSourceIndex++
  return name
}

const postDoneMessage = (result: IngestResult): void => {
  postProgressMessage(true)
  // Transfer large binary buffers to avoid costly copies
  const transferBuffers = [
    result.data.segments.segmentBuffer.buffer,
    result.data.segments.indexTable.buffer,
    result.data.segments.aoiPool.buffer,
  ]

  self.postMessage({ type: 'done', result }, { transfer: transferBuffers })
}

const handleJobResult = (result: IngestResult | null): void => {
  if (result === null) return
  job = null
  fileNames = []
  nextSourceIndex = 0
  postDoneMessage(result)
}

self.onmessage = async e => await processEvent(e)

async function processEvent(e: MessageEvent): Promise<void> {
  const { data, type, promptId: _promptId, ...rest } = e.data
  void rest
  try {
    switch (type) {
      case 'file-names': {
        if (!isStringArray(data)) throw new Error('File names are not string[]')
        fileNames = data
        nextSourceIndex = 0
        processedBytes = 0
        lastProgressMessageAt = 0
        job = new IngestJob(fileNames, FORMAT_REGISTRY, ctx)
        return
      }
      case 'test-stream':
        if (!isReadableStream(data))
          throw new Error('Stream is not ReadableStream')
        return
      case 'stream': {
        if (!isReadableStream(data))
          throw new Error('Stream is not ReadableStream')
        if (job === null) throw new Error('Ingest job is not initialized')
        handleJobResult(await job.add(streamSource(nextSourceName(), data)))
        return
      }
      case 'buffer': {
        if (job === null) throw new Error('Ingest job is not initialized')
        handleJobResult(
          await job.add(
            bufferSource(nextSourceName(), new Uint8Array(data as ArrayBuffer))
          )
        )
        return
      }
      case 'zip-buffer': {
        const { buffer, zipName } = data as {
          buffer: ArrayBuffer
          zipName: string
        }
        if (job === null) throw new Error('Ingest job is not initialized')
        // Advance the name cursor — zip buffers arrive in fileNames order too.
        nextSourceName()
        handleJobResult(
          await job.add(bufferSource(zipName, new Uint8Array(buffer)))
        )
        return
      }
      case 'prompt-response': {
        if (promptResolver === null)
          throw new Error('No pending ingest prompt to resolve')
        const resolve = promptResolver
        promptResolver = null
        resolve(typeof data === 'string' ? data : '')
        return
      }
      default:
        throw new Error('Unknown const type in worker', data)
    }
  } catch (error) {
    self.postMessage({ type: 'fail', data: error })
  }
}
