/**
 * The engine on the command line. `main` is the program; `bin.ts` wires it
 * to the process so tests can run it in place.
 */
import { createHash } from 'node:crypto'
import { createReadStream, openAsBlob } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { parseArgs } from 'node:util'
import {
  ANALYSIS_SCHEMA,
  applyAnalysis,
  exportAnalysis,
  inspect,
  metricCatalog,
  type Analysis,
} from '$lib/data/analysis'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { getAllParticipants, getStimuli } from '$lib/data/engine/selectors'
import {
  METRIC_EXPORT_CONTRACT_LONG,
  METRIC_EXPORT_CONTRACT_WIDE,
  exportMetrics,
} from '$lib/data/export/mappers/metrics'
import { ingest } from '$lib/data/ingest/ingest'
import { instanceMatchesContract } from '$lib/metrics/filters'
import { GAZEPLOTTER_VERSION } from '$lib/version'

const USAGE = `gazeplotter ${GAZEPLOTTER_VERSION}

Usage:
  gazeplotter inspect  <files...>             What the recordings contain, as JSON
  gazeplotter analysis <workspace>            The workspace's Analysis, as JSON
  gazeplotter metrics  <files...> [options]   The metrics table, as CSV
  gazeplotter catalog                         Every base metric in the library, as JSON

Files are eye-tracker exports, CSV event files, or .gazeplotter workspaces (several combine into one).

Options for metrics (inspect takes --analysis and --prompt too):
  --analysis <file>       Analysis JSON, or a workspace whose Analysis replays first
  --metrics <ids>|all     Configured metric instances to compute, by id or label; or every exportable one.
                          Required unless --analysis names them. A metric is a base plus parameters
                          plus a projection: inspect lists the dataset's instances, catalog the bases
  --participants <names>  A participants selection, or participant names, comma-separated (default: all)
  --stimuli <names>       A stimuli selection, or stimulus names, comma-separated (default: all)
  --format <long|wide>    Table layout (default: long)
  --start <ms> --end <ms> Time range in milliseconds of recording time
  --codebook              Also write <stem>-codebook.csv
  --decimal <. or ,>      Decimal separator (default: .)
  --out <file.csv>        Write there instead of stdout; <stem>.analysis.json and <stem>.run.json go beside it
  --prompt <id=value>     Answer a format prompt, repeatable (Tobii: tobii-parsing-input=<JSON config>)
  --lenient               Exit 0 even when a name matched nothing or the table is empty

Exit codes: 0 done; 1 error; 2 a name in the Analysis or an option matched nothing, or the table has no rows.
`

export interface Io {
  stdout(text: string): void
  stderr(text: string): void
}

type Values = {
  analysis?: string
  metrics?: string
  participants?: string
  stimuli?: string
  format: string
  start?: string
  end?: string
  codebook: boolean
  decimal: string
  out?: string
  prompt: string[]
  lenient: boolean
  help: boolean
}

/** Exit 2: the run completed, but not over what was asked for. */
class Unmatched extends Error {}

export async function main(argv: string[], io: Io): Promise<number> {
  try {
    const { values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        analysis: { type: 'string' },
        metrics: { type: 'string' },
        participants: { type: 'string' },
        stimuli: { type: 'string' },
        format: { type: 'string', default: 'long' },
        start: { type: 'string' },
        end: { type: 'string' },
        codebook: { type: 'boolean', default: false },
        decimal: { type: 'string', default: '.' },
        out: { type: 'string' },
        prompt: { type: 'string', multiple: true, default: [] },
        lenient: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
    })
    const [command, ...paths] = positionals
    if (values.help) {
      io.stdout(USAGE)
      return 0
    }
    const run = command ? COMMANDS[command] : undefined
    if (!run || (paths.length === 0 && command !== 'catalog')) {
      io.stderr(USAGE)
      return 1
    }
    await run(paths, values, io)
    return 0
  } catch (error) {
    io.stderr(`gazeplotter: ${error instanceof Error ? error.message : String(error)}\n`)
    return error instanceof Unmatched ? 2 : 1
  }
}

const COMMANDS: Record<string, (paths: string[], values: Values, io: Io) => Promise<void>> = {
  async catalog(_paths, _values, io) {
    io.stdout(json(metricCatalog()))
  },
  async analysis(paths, _values, io) {
    io.stdout(json((await loadAnalysis(paths[0])).analysis))
  },
  async inspect(paths, values, io) {
    const { engine, unmatched } = await load(paths, values, io)
    io.stdout(json(inspect(engine)))
    refuse(unmatched, values)
  },
  async metrics(paths, values, io) {
    if (values.format !== 'long' && values.format !== 'wide')
      throw new Error(`--format must be long or wide, not ${values.format}`)
    if (values.decimal !== '.' && values.decimal !== ',')
      throw new Error(`--decimal must be . or , not ${values.decimal}`)
    const timeStart = millis(values.start, '--start')
    const timeEnd = millis(values.end, '--end')
    const format = values.format
    const { engine, analysis, unmatched, inputs } = await load(paths, values, io)

    const contract = format === 'long' ? METRIC_EXPORT_CONTRACT_LONG : METRIC_EXPORT_CONTRACT_WIDE
    const instances = engine.metadata!.metricInstances
    // A metric in the table is a configured instance (base, parameters,
    // projection), never "a metric" in the abstract, so the choice is
    // explicit: named ids, every instance, or the Analysis that defines them.
    if (!values.metrics && !analysis) {
      const library = instances
        .map(i => `  ${i.id}  ${i.label}`)
        .join('\n')
      throw new Error(
        `Say which configured metrics to compute: --metrics <ids>, --metrics all, or --analysis <file>.\n` +
          `This dataset's library (starter instances; the app or an Analysis configures others):\n${library}`
      )
    }
    const chosen =
      values.metrics && values.metrics !== 'all'
        ? [...new Set(values.metrics.split(',').map(s => s.trim()))].map(key => {
            const hits = instances.filter(i => i.id === key || i.label === key)
            if (hits.length === 0) throw new Error(`No metric instance ${key}; see inspect`)
            if (hits.length > 1)
              throw new Error(`Metric label ${key} is ambiguous: ${hits.map(h => h.id).join(', ')}`)
            return hits[0]
          })
        : instances.filter(i => instanceMatchesContract(i, contract, engine.capabilities))
    const participantIds = entityIds(engine, 'participants', values.participants, unmatched)
    const stimulusIds = entityIds(engine, 'stimuli', values.stimuli, unmatched)

    const result = await exportMetrics(engine, {
      fileName: 'metrics',
      participantIds,
      stimulusIds,
      metricInstanceIds: chosen.map(i => i.id),
      format,
      csvOptions: { decimalSeparator: values.decimal },
      timeStart,
      timeEnd,
      includeCodebook: values.codebook,
    })
    if (result.rows === 0) unmatched.push('rows: the table is empty')

    if (!values.out) {
      io.stdout(result.dataContent)
      refuse(unmatched, values)
      return
    }
    const out = values.out.endsWith('.csv') ? values.out : `${values.out}.csv`
    const stem = out.slice(0, -4)
    await writeFile(out, result.dataContent)
    if (result.codebookContent !== null) await writeFile(`${stem}-codebook.csv`, result.codebookContent)
    // The Analysis beside the table is the one that was asked for, verbatim,
    // so a reused file never erodes; the run record says what was matched.
    await writeFile(`${stem}.analysis.json`, json(analysis?.analysis ?? exportAnalysis(engine.toDataType()!)))
    await writeFile(
      `${stem}.run.json`,
      json({
        gazeplotter: GAZEPLOTTER_VERSION,
        inputs,
        analysis: analysis ? { file: analysis.file, sha256: analysis.sha256 } : null,
        participants: participantIds.map(id => getAllParticipants(engine).find(p => p.id === id)?.displayedName),
        stimuli: stimulusIds.map(id => getStimuli(engine).find(s => s.id === id)?.displayedName),
        metrics: chosen.map(i => i.id),
        timeStart,
        timeEnd,
        format,
        decimal: values.decimal,
        rows: result.rows,
        unmatched,
      })
    )
    io.stderr(`Wrote ${result.rows} rows to ${out}\n`)
    refuse(unmatched, values)
  },
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

function millis(text: string | undefined, flag: string): number {
  if (text === undefined) return 0
  const value = Number(text)
  if (!Number.isFinite(value) || value < 0) throw new Error(`${flag} expects milliseconds, got ${text}`)
  return value
}

function refuse(unmatched: string[], values: Values) {
  if (unmatched.length > 0 && !values.lenient) throw new Unmatched(`not matched: ${unmatched.join('; ')}`)
}

async function open(paths: string[]): Promise<File[]> {
  return Promise.all(
    paths.map(async p => {
      try {
        return new File([await openAsBlob(p)], basename(p))
      } catch (error) {
        throw new Error(`${p}: ${error instanceof Error ? error.message : String(error)}`)
      }
    })
  )
}

function sha256(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    createReadStream(path)
      .on('data', chunk => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject)
  })
}

/** Ingests the files, replays `--analysis` when given, and reports warnings. */
async function load(paths: string[], values: Values, io: Io) {
  const prompts = Object.fromEntries(
    values.prompt.map(pair => {
      const at = pair.indexOf('=')
      if (at < 0) throw new Error(`--prompt expects id=value, got ${pair}`)
      return [pair.slice(0, at), pair.slice(at + 1)]
    })
  )
  const files = await open(paths)
  const inputs = await Promise.all(
    paths.map(async (p, i) => ({ name: files[i].name, bytes: files[i].size, sha256: await sha256(p) }))
  )
  const loaded = await ingest(files, { prompts })
  const unmatched: string[] = []
  const analysis = values.analysis ? await loadAnalysis(values.analysis) : null
  if (analysis) {
    const applied = applyAnalysis(loaded.engine.toDataType()!, analysis.analysis)
    loaded.engine.loadDataset(applied.data)
    unmatched.push(...applied.unmatched)
  }
  for (const warning of loaded.warnings) io.stderr(`warning: ${warning}\n`)
  return { engine: loaded.engine, analysis, unmatched, inputs }
}

/** An Analysis JSON, or the Analysis of a workspace file. */
async function loadAnalysis(
  path: string
): Promise<{ analysis: Analysis; file: string; sha256: string }> {
  const file = basename(path)
  const digest = await sha256(path)
  let parsed: unknown = null
  try {
    parsed = JSON.parse(await readFile(path, 'utf8'))
  } catch {
    // Not JSON text: a .gazeplotter archive, read below.
  }
  if (parsed && typeof parsed === 'object' && 'schema' in parsed) {
    const { schema } = parsed as { schema: unknown }
    if (schema !== ANALYSIS_SCHEMA)
      throw new Error(`${file}: Analysis schema ${String(schema)}; this build reads ${ANALYSIS_SCHEMA}`)
    return { analysis: parsed as Analysis, file, sha256: digest }
  }
  const { engine, kind } = await ingest(await open([path]))
  if (kind !== 'workspace') throw new Error(`${path} is neither an Analysis nor a workspace`)
  return { analysis: exportAnalysis(engine.toDataType()!), file, sha256: digest }
}

/** A saved selection by name, or displayed names; names that match nothing
 *  are reported. Default: every visible entity. */
function entityIds(
  engine: DataEngine,
  axis: 'participants' | 'stimuli',
  text: string | undefined,
  unmatched: string[]
): number[] {
  const entities = axis === 'participants' ? getAllParticipants(engine) : getStimuli(engine)
  if (!text) return entities.map(e => e.id)
  const meta = engine.metadata!
  const selection =
    axis === 'participants'
      ? meta.participantsSelections.find(s => s.name === text)?.participantsIds
      : meta.stimuliSelections?.find(s => s.name === text)?.memberIds
  if (selection) return selection
  return text.split(',').flatMap(name => {
    const ids = entities.filter(e => e.displayedName === name.trim()).map(e => e.id)
    if (ids.length === 0) unmatched.push(`${axis}: ${name.trim()}`)
    return ids
  })
}
