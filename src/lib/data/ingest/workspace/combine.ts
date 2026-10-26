import type { AttributeDataType, DataType, EntitySelection, NameSelection } from '$lib/data/types'
import { binarySegmentsToJsonWithSpatial, jsonSegmentsToBinary } from '$lib/data/binary'
import { displayedNameOf } from '$lib/data/merge/shared'
import type { IngestResult } from '../kernel/result'

type Workspace = Extract<IngestResult, { kind: 'workspace' }>
type Spatial = (number[] | null)[][][]

/**
 * Several saved workspaces as one: separate data collections of one study.
 * Stimuli, participants, categories, AOIs and event channels match by
 * ORIGINAL name (the recording's identity, as a multi-file parse keys them);
 * the rest append. The earliest collection (by when its data was parsed,
 * whatever the upload order) is the base: its ids, names, layout and settings
 * stay as they were, and later collections follow it. A (stimulus, participant) cell held by two
 * files is refused, never overwritten or concatenated. A new participant or
 * stimulus shown under a name an earlier file uses gets a numbered one, so
 * the combine never merges by display name; renaming them alike does.
 */
export function combineWorkspaces(files: { name: string; workspace: IngestResult }[]): Workspace {
  const [first, ...rest] = files
    .map(({ name, workspace }) => {
      if (workspace.kind !== 'workspace') throw new Error(`${name} is not a GazePlotter workspace`)
      if (workspace.data.merges?.length)
        throw new Error(`${name} has merged stimuli or participants. Unmerge them and save it before combining.`)
      return { name, workspace }
    })
    .sort((a, b) => compareParseDates(a.workspace, b.workspace))
  const base = first.workspace
  const data = base.data
  const { segments, spatialData } = binarySegmentsToJsonWithSpatial(data.segments)
  let spatial: Spatial | undefined = spatialData
  const warnings: string[] = []
  const mediaBlobs = { ...base.mediaBlobs }
  let fileMetadata = base.fileMetadata

  for (const { name, workspace } of rest) {
    const inc = workspace.data
    if (inc.isOrdinalOnly !== data.isOrdinalOnly)
      throw new Error(`${first.name} and ${name} cannot combine: only one of them has timing`)
    const incSegs = binarySegmentsToJsonWithSpatial(inc.segments)

    const stimulusCountBefore = data.stimuli.data.length
    const participantCountBefore = data.participants.data.length
    const stim = combineAttribute(data.stimuli, inc.stimuli)
    const part = combineAttribute(data.participants, inc.participants)
    warnings.push(...renameNotice('Participants', disambiguate(data.participants, participantCountBefore), name))
    warnings.push(...renameNotice('Stimuli', disambiguate(data.stimuli, stimulusCountBefore), name))
    const cat = combineAttribute(data.categories, inc.categories)
    const stimuli = data.stimuli.data.length
    const participants = data.participants.data.length

    // Per-stimulus dictionaries: a matched stimulus unifies, a new one copies.
    const aoi = combinePerStimulus(data.aois, inc.aois, stim, stimulusCountBefore, stimuli)
    const channel = combinePerStimulus(data.eventData, inc.eventData, stim, stimulusCountBefore, stimuli)

    for (let s = 0; s < stimuli; s++) {
      segments[s] ??= []
      for (let p = segments[s].length; p < participants; p++) segments[s][p] = []
      if (spatial) {
        spatial[s] ??= []
        for (let p = spatial[s].length; p < participants; p++) spatial[s][p] = []
      }
      const events = (data.eventData.events[s] ??= [])
      for (let c = 0; c < data.eventData.data[s].length; c++) {
        const cells = (events[c] ??= [])
        for (let p = cells.length; p < participants; p++) cells[p] = []
      }
    }
    if (!spatial && incSegs.spatialData) spatial = segments.map(row => row.map(() => []))

    for (let s = 0; s < inc.stimuli.data.length; s++) {
      const S = stim[s]
      for (let p = 0; p < inc.participants.data.length; p++) {
        const P = part[p]
        const cellSegments = incSegs.segments[s]?.[p] ?? []
        const cellEvents = (inc.eventData.events[s] ?? []).map(byParticipant => byParticipant?.[p] ?? [])
        if (cellSegments.length === 0 && cellEvents.every(e => e.length === 0)) continue
        if (holdsCell(data, segments, S, P)) {
          throw new Error(
            `${name} and ${first.name} both hold ${displayedNameOf(data.participants.data[P])} on ${displayedNameOf(data.stimuli.data[S])}. Combine joins different recordings only.`
          )
        }
        segments[S][P] = cellSegments.map(seg => [seg[0], seg[1], cat[seg[2]], ...seg.slice(3).map(a => aoi[s][a])])
        if (spatial) spatial[S][P] = incSegs.spatialData?.[s]?.[p] ?? cellSegments.map(() => null)
        cellEvents.forEach((occurrences, c) => {
          if (occurrences.length > 0) data.eventData.events[S][channel[s][c]][P] = occurrences
        })
      }
    }

    data.participantsSelections = appendSelections(
      data.participantsSelections,
      inc.participantsSelections,
      s => ({ ...s, participantsIds: s.participantsIds.map(id => part[id]) }),
      s => s.participantsIds
    )
    data.stimuliSelections = appendIdSelections(data.stimuliSelections, inc.stimuliSelections, stim)
    data.categoriesSelections = appendIdSelections(data.categoriesSelections, inc.categoriesSelections, cat)
    data.eventsSelections = appendNameSelections(data.eventsSelections, inc.eventsSelections)
    data.aois.selections = appendNameSelections(data.aois.selections, inc.aois.selections)

    const instanceIds = new Map(data.metricInstances.map(i => [i.id, JSON.stringify(i)]))
    for (const instance of inc.metricInstances) {
      const known = instanceIds.get(instance.id)
      if (known === undefined) data.metricInstances.push(instance)
      else if (known !== JSON.stringify(instance)) data.metricInstances.push({ ...instance, id: crypto.randomUUID() })
    }

    if (inc.dataExclusions?.length) data.dataExclusions = [...(data.dataExclusions ?? []), ...inc.dataExclusions]
    for (const [id, media] of Object.entries(inc.stimuliMedia ?? {})) {
      const S = stim[Number(id)]
      if (data.stimuliMedia?.[S]) continue
      data.stimuliMedia = { ...data.stimuliMedia, [S]: media }
      const blob = workspace.mediaBlobs?.[Number(id)]
      if (blob) mediaBlobs[S] = blob
    }

    const incMeta = workspace.fileMetadata
    if (!fileMetadata) fileMetadata = incMeta
    else if (incMeta)
      fileMetadata = {
        ...fileMetadata,
        fileNames: [...fileMetadata.fileNames, ...incMeta.fileNames],
        fileSizes: [...fileMetadata.fileSizes, ...incMeta.fileSizes],
      }
  }

  data.segments = jsonSegmentsToBinary(segments, spatial)
  data.capabilities = {
    segmented: data.segments.segmentBuffer.length > 0,
    spatial: data.segments.hasSpatialData,
    event: data.eventData.events.some(channels => channels.some(cells => cells.some(e => e?.length > 0))),
  }
  return {
    ...base,
    data,
    fileMetadata,
    ...(Object.keys(mediaBlobs).length > 0 ? { mediaBlobs } : {}),
    ...(warnings.length > 0 ? { warnings } : {}),
  }
}

/** Earlier parse first; a file without a date goes last (the sort is stable, so ties keep upload order). */
function compareParseDates(a: Workspace, b: Workspace): number {
  const dateA = a.fileMetadata?.parseDate ?? '￿'
  const dateB = b.fileMetadata?.parseDate ?? '￿'
  return dateA < dateB ? -1 : dateA > dateB ? 1 : 0
}

/** Display order as a full id list: the stored vector (empty = identity) plus any id it leaves out. */
function fullOrder(order: readonly number[] | undefined, count: number): number[] {
  const out = [...new Set(order ?? [])].filter(id => id >= 0 && id < count)
  const listed = new Set(out)
  for (let id = 0; id < count; id++) if (!listed.has(id)) out.push(id)
  return out
}

/** Appends `incoming` rows `target` lacks (by original name); incoming id -> combined id. */
function unify(target: string[][], incoming: readonly string[][]): number[] {
  const byName = new Map(target.map((row, id) => [row[0], id]))
  return incoming.map(row => {
    let id = byName.get(row[0])
    if (id === undefined) {
      id = target.push([...row]) - 1
      byName.set(row[0], id)
    }
    return id
  })
}

/** `order` (over `countBefore` rows) followed by the rows `remap` appended, in their own order. */
function extendOrder(order: readonly number[] | undefined, countBefore: number, incOrder: readonly number[] | undefined, remap: number[]): number[] {
  const out = fullOrder(order, countBefore)
  for (const id of fullOrder(incOrder, remap.length)) if (remap[id] >= countBefore) out.push(remap[id])
  return out
}

function combineAttribute(target: AttributeDataType, incoming: AttributeDataType): number[] {
  const before = target.data.length
  const remap = unify(target.data, incoming.data)
  target.orderVector = extendOrder(target.orderVector, before, incoming.orderVector, remap)
  return remap
}

/** AOIs or event channels: `[incoming stimulus][incoming id]` -> combined id. */
function combinePerStimulus(
  target: { data: string[][][]; orderVector: number[][] },
  incoming: { data: string[][][]; orderVector: number[][] },
  stim: number[],
  stimulusCountBefore: number,
  stimuli: number
): number[][] {
  const orderVector = target.data.map((rows, s) => fullOrder(target.orderVector[s], rows.length))
  const remaps = stim.map((S, s) => {
    const rows = incoming.data[s] ?? []
    if (S >= stimulusCountBefore) {
      target.data[S] = rows.map(row => [...row])
      orderVector[S] = fullOrder(incoming.orderVector[s], rows.length)
      return rows.map((_, id) => id)
    }
    const before = (target.data[S] ??= []).length
    const remap = unify(target.data[S], rows)
    orderVector[S] = extendOrder(orderVector[S], before, incoming.orderVector[s], remap)
    return remap
  })
  for (let S = 0; S < stimuli; S++) {
    target.data[S] ??= []
    orderVector[S] ??= fullOrder(undefined, target.data[S].length)
  }
  target.orderVector = orderVector
  return remaps
}

function holdsCell(data: DataType, segments: number[][][][], s: number, p: number): boolean {
  return segments[s][p].length > 0 || data.eventData.events[s].some(cells => (cells[p]?.length ?? 0) > 0)
}

/** Rows from `before` on that show a name an earlier row shows get the next free "name (n)"; returns "old -> new". */
function disambiguate(target: AttributeDataType, before: number): string[] {
  const earlier = new Set(target.data.slice(0, before).map(row => displayedNameOf(row)))
  const taken = new Set(target.data.map(row => displayedNameOf(row)))
  const renames: string[] = []
  for (const row of target.data.slice(before)) {
    const name = displayedNameOf(row)
    if (name === '' || !earlier.has(name)) continue
    let n = 2
    while (taken.has(`${name} (${n})`)) n++
    row[1] = `${name} (${n})`
    taken.add(row[1])
    renames.push(`${name} to ${row[1]}`)
  }
  return renames
}

function renameNotice(axis: string, renames: string[], name: string): string[] {
  if (renames.length === 0) return []
  const listed = renames.length > 3 ? `${renames.slice(0, 3).join(', ')} and ${renames.length - 3} more` : renames.join(', ')
  return [`${axis} in ${name} renamed ${listed}: those names belong to other recordings. Give two the same name to make them one.`]
}

/** Incoming selections with fresh ids, skipping exact copies and renaming name clashes. */
function appendSelections<T extends { id: number; name: string }>(
  target: T[] | undefined,
  incoming: T[] | undefined,
  remap: (s: T) => T,
  members: (s: T) => readonly (number | string)[]
): T[] {
  const out = [...(target ?? [])]
  const key = (s: T) => JSON.stringify([...members(s)].sort())
  for (const selection of incoming ?? []) {
    const mapped = remap(selection)
    if (out.some(s => s.name === mapped.name && key(s) === key(mapped))) continue
    let name = mapped.name
    for (let n = 2; out.some(s => s.name === name); n++) name = `${mapped.name} (${n})`
    out.push({ ...mapped, id: Math.max(0, ...out.map(s => s.id)) + 1, name })
  }
  return out
}

const appendIdSelections = (target: EntitySelection[] | undefined, incoming: EntitySelection[] | undefined, remap: number[]) =>
  appendSelections(target, incoming, s => ({ ...s, memberIds: s.memberIds.map(id => remap[id]) }), s => s.memberIds)

const appendNameSelections = (target: NameSelection[] | undefined, incoming: NameSelection[] | undefined) =>
  appendSelections(target, incoming, s => s, s => s.names)
