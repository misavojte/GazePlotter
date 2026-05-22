import { EyePipeline } from './stream/Pipeline'
import { PupilCloudPipeline } from './batch/PupilPipeline'
import type { EyeSettingsType } from './types'
import type { DataType } from '../types'

/**
 * A worker file handling whole eyefiles processing.
 * It is a separate file to avoid blocking the main thread.
 */

let fileNames: string[] = []
let pipeline: EyePipeline | null = null
let pupilCloudPipeline: PupilCloudPipeline | null = null
let streams: ReadableStream[] = []
let zipBuffers: ArrayBuffer[] = []
let userInputResolver: (value: string) => void
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

const requestUserInput = (): Promise<string> => {
  self.postMessage({ type: 'request-user-input' })
  return new Promise(resolve => {
    userInputResolver = resolve
  })
}

type PipelineResult = { data: DataType; settings: EyeSettingsType }

const resetProgressState = (): void => {
  processedBytes = 0
  lastProgressMessageAt = 0
}

const postProgressMessage = (force = false): void => {
  const now = Date.now()
  if (!force && now - lastProgressMessageAt < PROGRESS_MESSAGE_INTERVAL_MS) {
    return
  }

  lastProgressMessageAt = now
  self.postMessage({ type: 'progress', processedBytes })
}

const recordProcessedBytes = (byteLength: number, force = false): void => {
  if (!Number.isFinite(byteLength) || byteLength <= 0) return
  processedBytes += byteLength
  postProgressMessage(force)
}

const resetZipState = (): void => {
  zipBuffers = []
  fileNames = []
  pupilCloudPipeline = null
}

const postDoneMessage = (dataWithSettings: PipelineResult): void => {
  const { data } = dataWithSettings
  postProgressMessage(true)
  // Transfer large binary buffers to avoid costly copies
  const transferBuffers = [
    data.segments.segmentBuffer.buffer,
    data.segments.indexTable.buffer,
    data.segments.aoiPool.buffer,
  ]

  self.postMessage(
    {
      type: 'done',
      data,
      classified: dataWithSettings.settings,
    },
    { transfer: transferBuffers }
  )
}
self.onmessage = async e => await processEvent(e)

async function processEvent(e: MessageEvent): Promise<void> {
  const { data, type } = e.data
  try {
    switch (type) {
      case 'file-names':
        if (!isStringArray(data)) throw new Error('File names are not string[]')
        fileNames = data
        resetProgressState()
        // Check if files are ZIP files (Pupil Cloud) or regular eye-tracking files
        const isZipFiles = fileNames.some(name =>
          name.toLowerCase().endsWith('.zip')
        )
        if (isZipFiles) {
          pupilCloudPipeline = new PupilCloudPipeline(fileNames)
        } else {
          pipeline = new EyePipeline(fileNames, requestUserInput, byteLength =>
            recordProcessedBytes(byteLength)
          )
        }
        return
      case 'test-stream':
        if (!isReadableStream(data))
          throw new Error('Stream is not ReadableStream')
        return
      case 'stream':
        return await evalStream(data)
      case 'buffer':
        return await evalBuffer(data)
      case 'zip-buffer':
        return await evalZipBuffer(data)
      case 'user-input':
        return userInputResolver(data)
      default:
        throw new Error('Unknown const type in worker', data)
    }
  } catch (error) {
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
      const dataWithSettings = await pipeline.addNewStream(stream)
      if (dataWithSettings !== null) {
        postDoneMessage(dataWithSettings)
        streams = []
        fileNames = []
      }
    }
  }
}

/**
 * Handles ZIP buffer processing for Pupil Cloud files.
 * Accumulates buffers and processes them sequentially when all are received.
 * @param data - Object containing buffer and zipName
 */
const evalZipBuffer = async (data: unknown): Promise<void> => {
  const { buffer } = data as { buffer: ArrayBuffer; zipName: string }

  if (pupilCloudPipeline === null)
    throw new Error('Pupil Cloud pipeline is not initialized')
  if (fileNames.length === 0) throw new Error('No files to process')

  zipBuffers.push(buffer)

  // Process all ZIPs when we have received them all
  if (zipBuffers.length !== fileNames.length) {
    return
  }

  // Process each ZIP sequentially once all ZIP inputs are present.
  for (let i = 0; i < zipBuffers.length; i++) {
    const dataWithSettings = await pupilCloudPipeline.addNewZip(
      new Uint8Array(zipBuffers[i]),
      fileNames[i]
    )
    recordProcessedBytes(zipBuffers[i].byteLength, true)
    // Only the last ZIP should return the accumulated result.
    if (dataWithSettings !== null) {
      postDoneMessage(dataWithSettings)
      resetZipState()
      return
    }
  }

  const processedZipNames = fileNames.join(', ')
  resetZipState()
  throw new Error(
    `Pupil Cloud ZIP processing completed without producing final data for: ${processedZipNames}`
  )
}
