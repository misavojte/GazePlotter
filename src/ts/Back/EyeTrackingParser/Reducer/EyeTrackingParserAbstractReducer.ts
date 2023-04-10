import { ReducerOutputType } from '../../../Types/Parsing/ReducerOutputType'

export abstract class EyeTrackingParserAbstractReducer {
  abstract reduce (row: string[]): ReducerOutputType
  abstract finalize (): ReducerOutputType
  getIndex (header: string[], name: string): number {
    const index = header.indexOf(name)
    if (index === -1) throw new Error(`Column ${name} not found in header`)
    return index
  }
}
