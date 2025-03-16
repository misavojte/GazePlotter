import { EyeClassifier } from '../EyeClassifier/EyeClassifier'
import { EyeWriter } from '../EyeWriter/EyeWriter'
import { EyeParser } from '../EyeParser/EyeParser'
import { AbstractEyeDeserializer } from '../EyeDeserializer/AbstractEyeDeserializer'
import { BeGazeEyeDeserializer } from '../EyeDeserializer/BeGazeEyeDeserializer'
import { GazePointEyeDeserializer } from '../EyeDeserializer/GazePointEyeDeserializer'
import { OgamaEyeDeserializer } from '../EyeDeserializer/OgamaEyeDeserializer'
import { VarjoEyeDeserializer } from '../EyeDeserializer/VarjoEyeDeserializer'
import { CsvEyeDeserializer } from '../EyeDeserializer/CsvEyeDeserializer'
import { TobiiEyeDeserializer } from '../EyeDeserializer/TobiiEyeDeserializer'
import type { EyeSettingsType } from '$lib/type/Settings/EyeSettings/EyeSettingsType.js'
import { EyeSplitter } from '../EyeSplitter/EyeSplitter'
import type { DataType } from '$lib/type/Data/DataType.js'
import { EyeRefiner } from '../EyeRefiner/EyeRefiner'
import { CsvSegmentedEyeDeserializer } from '../EyeDeserializer/CsvSegmentedEyeDeserializer'

export class EyePipeline {
  fileNames: string[]
  fileCount = -1

  classifier: EyeClassifier = new EyeClassifier()
  writer: EyeWriter = new EyeWriter()
  deserializer: AbstractEyeDeserializer | null = null

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

  async addNewStream(stream: ReadableStream): Promise<DataType | null> {
    const parser = new EyeParser(stream)
    const firstTextChunk = await parser.getTextChunk()
    const settings = await this.classify(firstTextChunk)
    const splitter = new EyeSplitter(settings)
    const userStringInput: string =
      settings.type === 'tobii-with-event'
        ? await this.requestUserInputCallback()
        : ''
    this.processChunk(firstTextChunk, settings, splitter, userStringInput)

    while (!parser.isDone) {
      const chunk = await parser.getTextChunk()
      this.processChunk(chunk, settings, splitter, userStringInput)
    }

    this.releaseAfterFile(splitter, settings, userStringInput)

    if (this.isAllProcessed) {
      const refiner = new EyeRefiner()
      return refiner.process(this.writer.data)
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
      this.processRow(
        dataFromSplitter[i].split(settings.columnDelimiter),
        settings,
        userStringInput
      )
    }
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
      this.processRow(
        rows[i].split(settings.columnDelimiter),
        settings,
        userStringInput
      )
    }
  }

  private processRow(
    row: string[],
    settings: EyeSettingsType,
    userStringInput: string
  ): void {
    const headerRowId = settings.headerRowId

    if (this.rowIndex < headerRowId) {
      this.rowIndex++
      return
    }

    if (this.rowIndex === headerRowId) {
      this.deserializer = this.getDeserializer(
        row,
        this.currentFileName,
        settings,
        userStringInput
      )
      this.rowIndex++
      return
    }

    if (this.deserializer == null) throw new Error('Deserializer is undefined')
    this.rowIndex++
    const parsedRow = this.deserializer.deserialize(row)
    if (parsedRow === null) return
    if (Array.isArray(parsedRow))
      return parsedRow.forEach(row => this.writer.add(row))
    this.writer.add(parsedRow)
  }

  private getDeserializer(
    row: string[],
    fileName: string,
    settings: EyeSettingsType,
    userStringInput: string
  ): AbstractEyeDeserializer {
    switch (settings.type) {
      case 'begaze':
        return new BeGazeEyeDeserializer(row)
      case 'tobii':
        return this.getTobiiReducer(row, userStringInput)
      case 'tobii-with-event':
        return this.getTobiiReducer(row, userStringInput)
      case 'gazepoint':
        return new GazePointEyeDeserializer(row, fileName)
      case 'ogama':
        return new OgamaEyeDeserializer(row, fileName)
      case 'varjo':
        return new VarjoEyeDeserializer(row, fileName)
      case 'csv':
        return new CsvEyeDeserializer(row)
      case 'csv-segmented':
        return new CsvSegmentedEyeDeserializer(row)
      default:
        throw new Error('File type row reducer not implemented')
    }
  }

  private getTobiiReducer(
    row: string[],
    userInput: string
  ): TobiiEyeDeserializer {
    return new TobiiEyeDeserializer(row, userInput)
  }
}
