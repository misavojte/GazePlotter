import { EyeClassifier } from '../EyeClassifier/EyeClassifier'
import { BinaryEyeWriter } from '../EyeWriter/BinaryEyeWriter'
import { EyeParser } from '../EyeParser/EyeParser'
import { AbstractEyeDeserializer } from '../EyeDeserializer/AbstractEyeDeserializer'
import { BeGazeEyeDeserializer } from '../EyeDeserializer/BeGazeEyeDeserializer'
import { GazePointEyeDeserializer } from '../EyeDeserializer/GazePointEyeDeserializer'
import { OgamaEyeDeserializer } from '../EyeDeserializer/OgamaEyeDeserializer'
import { VarjoEyeDeserializer } from '../EyeDeserializer/VarjoEyeDeserializer'
import { CsvEyeDeserializer } from '../EyeDeserializer/CsvEyeDeserializer'
import { TobiiEyeDeserializer } from '../EyeDeserializer/TobiiEyeDeserializer'
import type { EyeSettingsType } from '$lib/gaze-data/back-process/types/EyeSettingsType.js'
import { EyeSplitter } from '../EyeSplitter/EyeSplitter'
import type { DataType } from '$lib/gaze-data/shared/types'
import { CsvSegmentedFromToEyeDeserializer } from '../EyeDeserializer/CsvSegmentedFromToEyeDeserializer'
import { CsvSegmentedDurationEyeDeserializer } from '../EyeDeserializer/CsvSegmentedDurationEyeDeserializer'

export class EyePipeline {
  fileNames: string[]
  fileCount = -1

  classifier: EyeClassifier = new EyeClassifier()
  writer: BinaryEyeWriter = new BinaryEyeWriter()
  deserializer: AbstractEyeDeserializer | null = null
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
    // parse first chunk and classify it
    const parser = new EyeParser(stream)
    const firstTextChunk = await parser.getTextChunk()
    const settings = await this.classify(firstTextChunk)
    const splitter = new EyeSplitter(settings)

    // request user input (if needed) and wait for it
    const userStringInput: string =
      settings.type === 'tobii-with-event'
        ? await this.requestUserInputCallback()
        : ''

    // update complete settings with user input
    this.completeSettings = {
      ...settings,
      userInputSetting: userStringInput,
    }

    // process first chunk
    this.processChunk(firstTextChunk, settings, splitter, userStringInput)

    // process remaining chunks
    while (!parser.isDone) {
      const chunk = await parser.getTextChunk()
      this.processChunk(chunk, settings, splitter, userStringInput)
    }

    this.releaseAfterFile(splitter, settings, userStringInput)

    if (this.isAllProcessed) {
      return {
        data: this.writer.buildFinalData(),
        settings: this.completeSettings,
      }
    }
    return null
  }

  releaseAfterFile(
    splitter: EyeSplitter,
    settings: EyeSettingsType,
    userStringInput: string
  ): void {
    const dataFromSplitter = splitter.release()
    for (let i = 0; i < dataFromSplitter.length; i++) {
      this.processRow(dataFromSplitter[i], settings, userStringInput)
    }

    this.finalizeFile()
    this.fileCount++
    this.rowIndex = 0
    this.deserializer = null
  }

  classify(chunk: string): EyeSettingsType {
    const classifier = this.classifier
    return classifier.classify(chunk)
  }

  processChunk(
    chunk: string,
    settings: EyeSettingsType,
    splitter: EyeSplitter,
    userStringInput: string
  ): void {
    const rows = splitter.splitChunk(chunk)
    for (let i = 0; i < rows.length; i++) {
      this.processRow(rows[i], settings, userStringInput)
    }
  }

  private processRow(
    rawRow: string,
    settings: EyeSettingsType,
    userStringInput: string
  ): void {
    const headerRowId = settings.headerRowId

    if (this.rowIndex < headerRowId) {
      this.rowIndex++
      return
    }

    if (this.rowIndex === headerRowId) {
      const header = rawRow.split(settings.columnDelimiter)
      this.deserializer = this.getDeserializer(
        header,
        this.currentFileName,
        settings,
        userStringInput
      )
      this.rowIndex++
      return
    }

    if (this.deserializer == null) throw new Error('Deserializer is undefined')
    this.rowIndex++
    const parsedRow = this.deserializer.processRow(rawRow)
    if (parsedRow === null) return
    if (Array.isArray(parsedRow))
      return parsedRow.forEach(row => this.writer.add(row))
    this.writer.add(parsedRow)
  }

  private getDeserializer(
    header: string[],
    fileName: string,
    settings: EyeSettingsType,
    userStringInput: string
  ): AbstractEyeDeserializer {
    switch (settings.type) {
      case 'begaze':
        return new BeGazeEyeDeserializer(header, settings.columnDelimiter)
      case 'tobii':
        return this.getTobiiReducer(
          header,
          userStringInput,
          settings.columnDelimiter
        )
      case 'tobii-with-event':
        return this.getTobiiReducer(
          header,
          userStringInput,
          settings.columnDelimiter
        )
      case 'gazepoint':
        return new GazePointEyeDeserializer(
          header,
          fileName,
          settings.columnDelimiter
        )
      case 'ogama':
        return new OgamaEyeDeserializer(
          header,
          fileName,
          settings.columnDelimiter
        )
      case 'varjo':
        return new VarjoEyeDeserializer(
          header,
          fileName,
          settings.columnDelimiter
        )
      case 'csv':
        return new CsvEyeDeserializer(header, settings.columnDelimiter)
      case 'csv-segmented':
        return new CsvSegmentedFromToEyeDeserializer(
          header,
          settings.columnDelimiter
        )
      case 'csv-segmented-duration':
        return new CsvSegmentedDurationEyeDeserializer(
          header,
          settings.columnDelimiter
        )
      default:
        throw new Error('File type row reducer not implemented')
    }
  }

  private getTobiiReducer(
    header: string[],
    userInput: string,
    columnDelimiter: string
  ): TobiiEyeDeserializer {
    return new TobiiEyeDeserializer(header, userInput, columnDelimiter)
  }

  private finalizeFile(): void {
    if (!this.deserializer) return
    const tail = this.deserializer.finalize()
    if (tail === null) return
    if (Array.isArray(tail)) tail.forEach(row => this.writer.add(row))
    else this.writer.add(tail)
  }
}
