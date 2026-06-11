import type {
  ArchiveFormatDefinition,
  ArchiveFormatInput,
  StreamFormatDefinition,
  WorkspaceFormatDefinition,
} from './format'
import { buildParseSettings } from './format'
import type { IngestContext } from './context'
import type { IngestResult } from './result'
import { DatasetBuilder } from './sink'
import type { IngestSource, SourceProbe } from './source'
import { drainSource, openSource, probeFromBytes } from './source'
import type { ParseSettings } from '../types'

/**
 * The formats a job dispatches over. Injected (the kernel never imports
 * concrete formats) — production passes `FORMAT_REGISTRY` from
 * `../formats/registry`, tests pass whatever they need.
 */
export interface FormatRegistry {
  readonly stream: readonly StreamFormatDefinition[]
  readonly archive: readonly ArchiveFormatDefinition[]
  readonly workspace: readonly WorkspaceFormatDefinition[]
}

/**
 * First stream format (in registry order) whose `detect` resolves the
 * probe. Registry order IS the specificity contract — see
 * `formats/registry.ts`.
 */
export function detectStreamFormat(
  formats: readonly StreamFormatDefinition[],
  probe: SourceProbe
): { def: StreamFormatDefinition; typeId: string } | null {
  for (const def of formats) {
    const typeId = def.detect(probe)
    if (typeId !== null) return { def, typeId }
  }
  return null
}

/**
 * One upload = one job. Sources are added as they arrive (in `fileNames`
 * order); when the last one is in, the job runs and produces the result.
 *
 * Routing rules (all characterized in tests):
 *  1. WORKSPACE PRECEDENCE — if the FIRST source is a workspace file, it is
 *     the entire result and every other source is ignored (the historical
 *     "first-file-wins" JSON rule, kept as an explicit policy).
 *  2. Archive sources (matched by file name) are read first, as one group,
 *     by their format.
 *  3. Remaining sources are content-detected and read sequentially in
 *     upload order into the shared sink — order matters, because the
 *     writer's dictionaries assign stimulus/participant ids first-seen.
 */
export class IngestJob {
  private readonly pending: IngestSource[] = []

  constructor(
    private readonly fileNames: string[],
    private readonly formats: FormatRegistry,
    private readonly ctx: IngestContext
  ) {}

  get isComplete(): boolean {
    return this.pending.length >= this.fileNames.length
  }

  /**
   * Add the next source. Returns the result once all expected sources
   * (one per entry in `fileNames`) have been added, null before that.
   */
  async add(source: IngestSource): Promise<IngestResult | null> {
    this.pending.push(source)
    if (!this.isComplete) return null
    return await this.run()
  }

  private async run(): Promise<IngestResult> {
    const sources = this.pending

    // 1. Workspace precedence (first source only).
    const workspaceDef = this.formats.workspace.find(f =>
      f.matchesFileName(sources[0].name)
    )
    if (workspaceDef) {
      return await workspaceDef.read(await drainSource(sources[0]), this.ctx)
    }

    const sink = new DatasetBuilder()
    let lastSettings: ParseSettings | null = null

    // 2. Archive group (claimed by file name, read together).
    let archiveDef: ArchiveFormatDefinition | null = null
    const archiveInputs: ArchiveFormatInput[] = []
    const streamSources: IngestSource[] = []
    for (const source of sources) {
      const def = this.formats.archive.find(f => f.matchesFileName(source.name))
      if (def && (archiveDef === null || archiveDef === def)) {
        archiveDef = def
        archiveInputs.push({
          name: source.name,
          bytes: await drainSource(source),
        })
      } else {
        streamSources.push(source)
      }
    }
    if (archiveDef) {
      const { settings } = await archiveDef.read(archiveInputs, sink, this.ctx)
      lastSettings = settings
    }

    // 3. Stream sources, sequentially, in upload order.
    for (const source of streamSources) {
      const opened = await openSource(source)
      const probe = probeFromBytes(source.name, opened.firstChunk)
      const match = detectStreamFormat(this.formats.stream, probe)
      if (!match) throw new Error('Unknown file type')

      const userInput = match.def.requiresUserInput?.(match.typeId)
        ? await this.ctx.prompt(match.def.promptId ?? match.typeId)
        : ''
      const settings = buildParseSettings(
        match.def,
        match.typeId,
        probe,
        userInput
      )
      sink.beginFile(settings, match.def.emptyDatasetError?.(userInput) ?? null)
      await match.def.read(
        { opened, typeId: match.typeId, probe, settings, userInput },
        sink,
        this.ctx
      )
      lastSettings = settings
    }

    if (lastSettings === null) throw new Error('Unknown file type')
    const data = sink.buildFinalData()
    return {
      kind: 'dataset',
      data,
      settings: lastSettings,
      ...(sink.warnings.length > 0 ? { warnings: [...sink.warnings] } : {}),
    }
  }
}
