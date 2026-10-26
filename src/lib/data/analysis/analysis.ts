/**
 * The Analysis: everything a workspace adds to raw recordings to turn them
 * into a study's analysis, keyed by displayed name so it replays onto other
 * recordings. It is a pure projection of the dataset, so a workspace file
 * already carries it; `exportAnalysis` reads it out, `applyAnalysis` replays
 * it. Names that fail to match are reported, never guessed.
 */
import { mergeParticipants } from '../merge/mergeParticipants'
import { mergeStimuli } from '../merge/mergeStimuli'
import type { DataType, EntitySelection, NameSelection } from '../types'
import { createMetricInstance, type MetricInstance } from '$lib/metrics/instances'
import { GAZEPLOTTER_VERSION } from '$lib/version'

export const ANALYSIS_SCHEMA = 1

/** A name in the source file and the name the analysis uses for it. */
export interface Rename {
  from: string
  to: string
}

/** A named selection and the displayed names of its members. */
export interface Members {
  name: string
  members: string[]
}

/** A fold of `members` into `into`, by their displayed names. */
export interface Merge {
  axis: 'participant' | 'stimulus'
  into: string
  members: string[]
}

export interface Analysis {
  gazeplotter: string
  schema: typeof ANALYSIS_SCHEMA
  /** Per-stimulus tables (AOIs, event channels) are keyed by stimulus name. */
  renames: {
    stimuli: Rename[]
    participants: Rename[]
    categories: Rename[]
    aois: Record<string, Rename[]>
    events: Record<string, Rename[]>
  }
  merges: Merge[]
  selections: {
    participants: Members[]
    stimuli: Members[]
    categories: Members[]
    aois: Members[]
    events: Members[]
  }
  noAoi: DataType['noAoiTreatment']
  metrics: MetricInstance[]
}

type Rows = (string[] | null)[]
interface Table {
  data: Rows
  orderVector: number[]
}

/** A row shows its displayed name, or its source name until one is set. */
const shown = (row: string[] | null | undefined) => (row ? row[1] || row[0] : undefined)
const displayedName = (table: Table, id: number) => shown(table.data[id])

/** The visible ids in display order; an empty vector means identity. */
const idsOf = (table: Table): number[] =>
  table.orderVector.length > 0 ? table.orderVector : table.data.map((_, i) => i)

/** Metric instances are JSON; the round-trip also sheds engine state proxies. */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const renamesOf = (rows: Rows = []): Rename[] =>
  rows.flatMap(row => (row && shown(row) !== row[0] ? [{ from: row[0], to: shown(row)! }] : []))

const namesOf = (table: Table, ids: number[]): string[] => [
  ...new Set(ids.map(id => displayedName(table, id)).filter((n): n is string => !!n)),
]

const members = (table: Table, selections: EntitySelection[] = []): Members[] =>
  selections.map(s => ({ name: s.name, members: namesOf(table, s.memberIds) }))

const nameMembers = (selections: NameSelection[] = []): Members[] =>
  selections.map(s => ({ name: s.name, members: [...s.names] }))

export function exportAnalysis(data: DataType): Analysis {
  // Every stimulus row, merged members included, so their renames survive;
  // rows sharing a displayed name pool their lists.
  const perStimulus = (tables: Rows[]) => {
    const out: Record<string, Rename[]> = {}
    data.stimuli.data.forEach((row, id) => {
      const name = shown(row)
      const renames = renamesOf(tables[id])
      if (!name || renames.length === 0) return
      const seen = new Set((out[name] ??= []).map(r => r.from))
      out[name].push(...renames.filter(r => !seen.has(r.from)))
    })
    return out
  }
  return {
    gazeplotter: GAZEPLOTTER_VERSION,
    schema: ANALYSIS_SCHEMA,
    renames: {
      stimuli: renamesOf(data.stimuli.data),
      participants: renamesOf(data.participants.data),
      categories: renamesOf(data.categories.data),
      aois: perStimulus(data.aois.data),
      events: perStimulus(data.eventData.data),
    },
    // The log holds only live merges: an un-merge drops its entry.
    merges: (data.merges ?? []).map(e => ({
      axis: e.axis,
      into: displayedName(e.axis === 'participant' ? data.participants : data.stimuli, e.representativeId) ?? '',
      members: e.members.map(m => m.displayedName),
    })),
    selections: {
      participants: data.participantsSelections.map(s => ({
        name: s.name,
        members: namesOf(data.participants, s.participantsIds),
      })),
      stimuli: members(data.stimuli, data.stimuliSelections),
      categories: members(data.categories, data.categoriesSelections),
      aois: nameMembers(data.aois.selections),
      events: nameMembers(data.eventsSelections),
    },
    noAoi: { ...data.noAoiTreatment },
    metrics: clone(data.metricInstances),
  }
}

/**
 * Replays `analysis` onto `data`: renames by source name, then merges and
 * selections by displayed name, then the No AOI treatment and the metric
 * library. `unmatched` lists every name that found nothing, as
 * `<where>: <name>`; a metric whose base is unknown to this version is
 * listed as `metric: <baseId>`. A merge whose members overlap on a stimulus
 * throws, as it does in the app: a different merge would be a different table.
 */
export function applyAnalysis(
  data: DataType,
  analysis: Analysis
): { data: DataType; unmatched: string[] } {
  const unmatched: string[] = []

  const renamed = (rows: Rows, renames: Rename[], where: string): Rows => {
    const out = rows.map(row => (row ? [...row] : row))
    for (const { from, to } of renames) {
      const hits = out.filter(row => row?.[0] === from)
      if (hits.length === 0) unmatched.push(`${where}: ${from}`)
      for (const row of hits) row![1] = to
    }
    return out
  }
  const renamedTable = (table: Table, renames: Rename[], where: string) => ({
    ...table,
    data: renamed(table.data, renames, where) as string[][],
  })

  let next: DataType = {
    ...data,
    stimuli: renamedTable(data.stimuli, analysis.renames.stimuli, 'stimulus'),
    participants: renamedTable(data.participants, analysis.renames.participants, 'participant'),
    categories: renamedTable(data.categories, analysis.renames.categories, 'category'),
  }

  const stimulusIds = (name: string) =>
    idsOf(next.stimuli).filter(id => displayedName(next.stimuli, id) === name)
  const perStimulus = (tables: Rows[], renames: Record<string, Rename[]>, what: string) => {
    const out = tables.map(rows => rows.map(row => (row ? [...row] : row)))
    for (const [stimulus, list] of Object.entries(renames)) {
      const ids = stimulusIds(stimulus)
      if (ids.length === 0) unmatched.push(`stimulus: ${stimulus}`)
      for (const id of ids) out[id] = renamed(out[id] ?? [], list, `${what} in ${stimulus}`)
    }
    return out as string[][][]
  }
  next = {
    ...next,
    aois: { ...next.aois, data: perStimulus(next.aois.data, analysis.renames.aois, 'aoi') },
    eventData: {
      ...next.eventData,
      data: perStimulus(next.eventData.data, analysis.renames.events, 'event'),
    },
  }

  for (const merge of analysis.merges) {
    const table = merge.axis === 'participant' ? next.participants : next.stimuli
    const into = idsOf(table).find(id => displayedName(table, id) === merge.into)
    if (into === undefined) {
      unmatched.push(`merge into ${merge.axis}: ${merge.into}`)
      continue
    }
    const ids = idsOf(table).filter(
      id => id !== into && merge.members.includes(displayedName(table, id)!)
    )
    for (const name of merge.members) {
      if (!ids.some(id => displayedName(table, id) === name) && name !== merge.into)
        unmatched.push(`merge member ${merge.axis}: ${name}`)
    }
    if (ids.length === 0) continue
    const fold = merge.axis === 'participant' ? mergeParticipants : mergeStimuli
    try {
      next = fold(next, into, ids, Date.now())
    } catch (error) {
      throw new Error(
        `Merge of ${merge.members.join(', ')} into ${merge.into} refused: ` +
          'the members record on the same stimulus. A merge joins one entity split across files, never repeated sessions.',
        { cause: error }
      )
    }
  }

  const idsByName = (table: Table, names: string[], where: string) =>
    names.flatMap(name => {
      const ids = idsOf(table).filter(id => displayedName(table, id) === name)
      if (ids.length === 0) unmatched.push(`${where}: ${name}`)
      return ids
    })
  const entitySelections = (table: Table, list: Members[], where: string): EntitySelection[] =>
    list.map((s, i) => ({ id: i + 1, name: s.name, memberIds: idsByName(table, s.members, `${where} ${s.name}`) }))
  const nameSelections = (list: Members[]): NameSelection[] =>
    list.map((s, i) => ({ id: i + 1, name: s.name, names: [...s.members] }))
  const { selections } = analysis

  // Through the one constructor, so a hand-edited or older file gets resolved
  // params and a valid projection, and an unknown base is reported, not kept.
  const metrics = analysis.metrics.flatMap(inst => {
    const made = createMetricInstance(clone(inst))
    if (!made) unmatched.push(`metric: ${inst.baseId}`)
    return made ? [made] : []
  })

  return {
    data: {
      ...next,
      participantsSelections: selections.participants.map((s, i) => ({
        id: i + 1,
        name: s.name,
        participantsIds: idsByName(next.participants, s.members, `participants selection ${s.name}`),
      })),
      stimuliSelections: entitySelections(next.stimuli, selections.stimuli, 'stimuli selection'),
      categoriesSelections: entitySelections(next.categories, selections.categories, 'categories selection'),
      aois: { ...next.aois, selections: nameSelections(selections.aois) },
      eventsSelections: nameSelections(selections.events),
      noAoiTreatment: { ...analysis.noAoi },
      metricInstances: metrics,
    },
    unmatched,
  }
}
