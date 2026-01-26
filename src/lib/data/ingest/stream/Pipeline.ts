import { EyeClassifier } from './Classifier'
import { BinaryEyeWriter } from '../writer'
import { ByteSplitter } from './Splitter'
import { AbstractAdapter } from './adapters/AbstractAdapter'
import { BeGazeAdapter } from './adapters/BeGazeAdapter'
import { GazePointAdapter } from './adapters/GazePointAdapter'
import { OgamaAdapter } from './adapters/OgamaAdapter'
import { VarjoAdapter } from './adapters/VarjoAdapter'
import { CsvAdapter } from './adapters/CsvAdapter'
import { TobiiAdapter } from './adapters/TobiiAdapter'
import type { EyeSettingsType } from '$lib/data/ingest/types'
import type { DataType } from '$lib/data/types'
import { CsvSegmentedFromToAdapter } from './adapters/CsvSegmentedFromToAdapter'
import { CsvSegmentedDurationAdapter } from './adapters/CsvSegmentedDurationAdapter'

export class EyePipeline {
  fileNames: string[]
  fileCount = -1

  classifier: EyeClassifier = new EyeClassifier()
  writer: BinaryEyeWriter = new BinaryEyeWriter()
  deserializer: AbstractAdapter | null = null
  completeSettings: EyeSettingsType | null = null

  requestUserInputCallback: () => Promise<string>
  rowIndex = 0

  get isAllProcessed(): boolean {
    return this.fileCount === this.fileNames.length - 1
  }

  get currentFileName(): string {
    const name = this.fileNames[this.fileCount + 1]
    if (name === undefined) throw new Error('File name is undefined')
    return name
  }

  constructor(
    fileNames: string[],
    requestUserInputCallback: () => Promise<string>
  ) {
    this.fileNames = fileNames
    this.requestUserInputCallback = requestUserInputCallback
  }

  async addNewStream(
    stream: ReadableStream
  ): Promise<{ data: DataType; settings: EyeSettingsType } | null> {
    // reset complete settings
    this.completeSettings = null
    // read first binary chunk and classify header
    const reader = stream.getReader()
    const firstRead = await reader.read()
    const firstChunk = firstRead.value ?? new Uint8Array()
    const settings = this.classifier.classifyFromBytes(firstChunk)
    this.writer.setEncoding(settings.encoding)
    const splitter = new ByteSplitter(settings)
    const decoder = new TextDecoder(settings.encoding)

    // request user input (if needed) and wait for it
    const userStringInput: string =
      settings.type === 'tobii-with-event'
        ? await this.requestUserInputCallback()
        : ''
    this.writer.setSourceInfo(settings.type, userStringInput)

    // update complete settings with user input
    this.completeSettings = {
      ...settings,
      userInputSetting: userStringInput,
    }

    // process first chunk
    this.processChunkBytes(
      firstChunk,
      settings,
      splitter,
      userStringInput,
      decoder
    )

    // process remaining chunks
    if (!firstRead.done) {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        this.processChunkBytes(
          value ?? new Uint8Array(),
          settings,
          splitter,
          userStringInput,
          decoder
        )
      }
    }

    this.releaseAfterFile(splitter, settings, userStringInput, decoder)

    if (this.isAllProcessed) {
      return {
        data: this.writer.buildFinalData(),
        settings: this.completeSettings,
      }
    }
    return null
  }

  releaseAfterFile(
    splitter: ByteSplitter,
    settings: EyeSettingsType,
    userStringInput: string,
    decoder: TextDecoder
  ): void {
    splitter.releaseTo(row => {
      this.processRowBytes(row, settings, userStringInput, decoder)
    })

    this.finalizeFile()
    this.fileCount++
    this.rowIndex = 0
    this.deserializer = null
  }

  classify(chunk: string): EyeSettingsType {
    const classifier = this.classifier
    return classifier.classify(chunk)
  }

  processChunkBytes(
    chunk: Uint8Array,
    settings: EyeSettingsType,
    splitter: ByteSplitter,
    userStringInput: string,
    decoder: TextDecoder
  ): void {
    splitter.processChunk(chunk, row => {
      this.processRowBytes(row, settings, userStringInput, decoder)
    })
  }

  private processRowBytes(
    rawRow: Uint8Array,
    settings: EyeSettingsType,
    userStringInput: string,
    decoder: TextDecoder
  ): void {
    const headerRowId = settings.headerRowId

    if (this.rowIndex < headerRowId) {
      this.rowIndex++
      return
    }

    if (this.rowIndex === headerRowId) {
      const headerText = decoder.decode(rawRow).replace(/^\uFEFF/, '')
      const header = headerText.split(settings.columnDelimiter)
      this.deserializer = this.getDeserializer(
        header,
        this.currentFileName,
        settings,
        userStringInput,
        rawRow
      )
      this.rowIndex++
      this.deserializer.onSegment = this.writer.addSegmentBytes.bind(
        this.writer
      )
      return
    }

    if (this.deserializer == null) throw new Error('Deserializer is undefined')
    this.rowIndex++
    this.deserializer.processRowBytes(rawRow, decoder)
  }

  private getDeserializer(
    header: string[],
    fileName: string,
    settings: EyeSettingsType,
    userStringInput: string,
    headerBytes?: Uint8Array
  ): AbstractAdapter {
    switch (settings.type) {
      case 'begaze':
        return new BeGazeAdapter(
          header,
          settings.columnDelimiter,
          settings.encoding
        )
      case 'tobii':
        return this.getTobiiReducer(
          header,
          userStringInput,
          settings.columnDelimiter,
          settings.encoding,
          headerBytes
        )
      case 'tobii-with-event':
        return this.getTobiiReducer(
          header,
          userStringInput,
          settings.columnDelimiter,
          settings.encoding,
          headerBytes
        )
      case 'gazepoint':
        return new GazePointAdapter(
          header,
          fileName,
          settings.columnDelimiter,
          settings.encoding
        )
      case 'ogama':
        return new OgamaAdapter(
          header,
          fileName,
          settings.columnDelimiter,
          settings.encoding
        )
      case 'varjo':
        return new VarjoAdapter(
          header,
          fileName,
          settings.columnDelimiter,
          settings.encoding
        )
      case 'csv':
        return new CsvAdapter(
          header,
          settings.columnDelimiter,
          settings.encoding
        )
      case 'csv-segmented':
        return new CsvSegmentedFromToAdapter(
          header,
          settings.columnDelimiter,
          settings.encoding
        )
      case 'csv-segmented-duration':
        return new CsvSegmentedDurationAdapter(
          header,
          settings.columnDelimiter,
          settings.encoding
        )
      default:
        throw new Error('File type row reducer not implemented')
    }
  }

  private getTobiiReducer(
    header: string[],
    userInput: string,
    columnDelimiter: string,
    encoding: EyeSettingsType['encoding'],
    headerBytes?: Uint8Array
  ): TobiiAdapter {
    return new TobiiAdapter(
      header,
      userInput,
      columnDelimiter,
      encoding,
      headerBytes
    )
  }

  private finalizeFile(): void {
    if (!this.deserializer) return
    this.deserializer.finalize()
  }
}
