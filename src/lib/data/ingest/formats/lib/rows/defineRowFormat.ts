import type {
  StreamFormatDefinition,
  StreamFormatInput,
} from '../../../kernel/format'
import type { IngestContext } from '../../../kernel/context'
import type { DatasetSink } from '../../../kernel/sink'
import type { SourceProbe } from '../../../kernel/source'
import type { ParseSettings } from '../../../types'
import { RowParser } from './RowParser'
import { RowSplitter } from './RowSplitter'

/**
 * Everything a row format gets to construct its `RowParser` for one file.
 * Covers the constructor variance across vendors: most take
 * (header, delimiter, encoding); some add the file name (GazePoint, Ogama,
 * Varjo derive the stimulus from it); Tobii additionally takes the user
 * input and the raw header bytes.
 */
export interface RowParserContext {
  header: string[]
  headerBytes: Uint8Array
  fileName: string
  settings: ParseSettings
  userInput: string
}

export interface RowFormatSpec {
  ids: readonly string[]
  displayName: string
  detect(probe: SourceProbe): string | null
  columnDelimiter: string | ((probe: SourceProbe) => string)
  headerRowId?: number
  promptId?: string
  requiresUserInput?(typeId: string): boolean
  emptyDatasetError?(userInput: string): string | null
  createRowParser(ctx: RowParserContext): RowParser
}

/**
 * Composes a `StreamFormatDefinition` for a row-oriented text format. The
 * `read` loop below is THE row spine: split chunks into rows, skip to the
 * header row, build the vendor's `RowParser`, then feed it every data row.
 * It is shared by all row formats and lives nowhere else.
 */
export function defineRowFormat(spec: RowFormatSpec): StreamFormatDefinition {
  return {
    kind: 'stream',
    ids: spec.ids,
    displayName: spec.displayName,
    detect: spec.detect,
    columnDelimiter: spec.columnDelimiter,
    headerRowId: spec.headerRowId,
    promptId: spec.promptId,
    requiresUserInput: spec.requiresUserInput,
    emptyDatasetError: spec.emptyDatasetError,
    read: (input, sink, ctx) => readRows(spec, input, sink, ctx),
  }
}

async function readRows(
  spec: RowFormatSpec,
  input: StreamFormatInput,
  sink: DatasetSink,
  ctx: IngestContext
): Promise<void> {
  const { opened, settings, userInput } = input
  const splitter = new RowSplitter(settings)
  const decoder = new TextDecoder(settings.encoding)
  const headerRowId = settings.headerRowId

  let rowIndex = 0
  // Holder object: the parser is assigned inside the closure below, which
  // defeats TS control-flow narrowing on a plain `let`.
  const state: { parser: RowParser | null } = { parser: null }

  const onRow = (rawRow: Uint8Array): void => {
    if (rowIndex < headerRowId) {
      rowIndex++
      return
    }

    if (rowIndex === headerRowId) {
      const headerText = decoder.decode(rawRow).replace(/^\uFEFF/, '')
      const header = headerText.split(settings.columnDelimiter)
      const parser = spec.createRowParser({
        header,
        headerBytes: rawRow,
        fileName: opened.name,
        settings,
        userInput,
      })
      // Bind once; the per-row call stays monomorphic (see DatasetSink).
      parser.onSegment = sink.addSegmentBytes
      parser.onEvent = event => sink.addEvent(event)
      parser.onWarning = message => sink.addWarning(message)
      parser.onExcludeSegmentGroup = (stimulus, participant, issues) =>
        sink.excludeSegmentGroup(stimulus, participant, issues)
      state.parser = parser
      rowIndex++
      return
    }

    if (state.parser === null) throw new Error('Row parser is undefined')
    rowIndex++
    state.parser.processRowBytes(rawRow, decoder)
  }

  // The first chunk was consumed for detection; process it first.
  splitter.processChunk(opened.firstChunk, onRow)
  ctx.reportBytes(opened.firstChunk.byteLength)

  if (!opened.firstDone) {
    while (true) {
      const { value, done } = await opened.reader.read()
      if (done) break
      const chunk = value ?? new Uint8Array()
      splitter.processChunk(chunk, onRow)
      ctx.reportBytes(chunk.byteLength)
    }
  }

  splitter.releaseTo(onRow)
  state.parser?.finalize()
}
