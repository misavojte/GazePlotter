import type {
  StreamFormatDefinition,
  StreamFormatInput,
} from '../../../kernel/format'
import type { IngestContext } from '../../../kernel/context'
import type { DatasetSink } from '../../../kernel/sink'
import type { SourceProbe } from '../../../kernel/source'
import type { ParseSettings } from '../../../types'
import { RowParser } from './RowParser'
import { LeadingRows, type RowScanFeed } from './rowScan'

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
  const decoder = new TextDecoder(settings.encoding)
  const leading = new LeadingRows(settings.encoding, settings.rowDelimiter)
  let rowIndex = 0
  // Holder object: assigned inside the closure below, which defeats TS
  // control-flow narrowing on a plain `let`.
  const state: { parser: RowParser | null; feed: RowScanFeed | null } = {
    parser: null,
    feed: null,
  }

  const createParser = (headerBytes: Uint8Array): RowParser => {
    const headerText = decoder.decode(headerBytes).replace(/^\uFEFF/, '')
    const header = headerText.split(settings.columnDelimiter)
    const created = spec.createRowParser({
      header,
      headerBytes,
      fileName: opened.name,
      settings,
      userInput,
    })
    // Bind once; the per-row call stays monomorphic (see DatasetSink).
    created.onSegment = sink.addSegmentBytes
    created.internCategory = sink.internCategory
    created.onEvent = event => sink.addEvent(event)
    created.onWarning = message => sink.addWarning(message)
    created.onBeginProvisionalGroup = (stimulus, participant) =>
      sink.beginProvisionalGroup(stimulus, participant)
    created.onCommitProvisionalGroup = handle =>
      sink.commitProvisionalGroup(handle)
    created.onDropProvisionalGroup = handle => sink.dropProvisionalGroup(handle)
    created.onRecordExclusion = (stimulus, participant, issues) =>
      sink.recordExclusion(stimulus, participant, issues)
    return created
  }

  // Leading rows (skipped rows, then the header) are split one at a time;
  // once the parser exists its feed takes every remaining byte.
  const processChunk = (chunk: Uint8Array, fin: boolean): void => {
    if (state.feed) {
      state.feed.push(chunk)
      return
    }
    leading.push(chunk)
    while (!state.feed) {
      const row = leading.next(fin)
      if (row === null) return
      if (rowIndex++ < settings.headerRowId) continue
      state.parser = createParser(row)
      state.feed = state.parser.openRowScanFeed(settings.rowDelimiter)
      state.feed.push(leading.rest())
    }
  }

  // The first chunk was consumed for detection; process it first.
  processChunk(opened.firstChunk, false)
  ctx.reportBytes(opened.firstChunk.byteLength)

  if (!opened.firstDone) {
    while (true) {
      const { value, done } = await opened.reader.read()
      if (done) break
      const chunk = value ?? new Uint8Array()
      processChunk(chunk, false)
      ctx.reportBytes(chunk.byteLength)
    }
  }

  // A header without a row end after it is still the header.
  if (!state.feed) processChunk(new Uint8Array(0), true)
  state.feed?.finish()
  state.parser?.finalize()
}
