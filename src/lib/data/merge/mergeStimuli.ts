import type { DataType, MergeLogEntry, MergeMember } from '$lib/data/types'
import {
  displayedNameOf,
  dropMergeEntry,
  restoreOrderVector,
  toNested,
  fromNested,
  type NestedDataset,
} from './shared'

/**
 * DataType-level STIMULUS merge / un-merge (see PLANMERGE.md M4).
 *
 * Folds member stimulus rows into a representative along the OUTER
 * (`segments[stimulus]`) axis. Unlike the participant axis, stimuli own the
 * per-stimulus AOI and event-channel dictionaries, so a stimulus merge must
 * ALSO reconcile those: the member's dictionary is unified into the
 * representative's by displayed name (representative authoritative — same-named
 * entries map to the rep's id, member-only entries append), and every moved
 * segment's raw AOI ids are remapped into the rep's id space. Lossless and
 * disjoint (per participant, at most one of rep/member holds segments), so
 * `unmerge(merge(x)) === x`. The member stimulus is tombstoned (its `data` rows
 * kept, dropped from `stimuli.orderVector`, ids stable), so its original
 * dictionaries remain available for un-merge and nothing keyed by stimulus id
 * is reindexed.
 */

/**
 * Unify `memberRows` into `repRows` by displayed name (rep authoritative).
 * Returns the merged dictionary, a total member-local -> merged-id remap, and
 * the rep's length before appending (so un-merge can shrink back).
 */
function reconcileDict(
  repRows: string[][],
  memberRows: string[][]
): { merged: string[][]; remap: number[]; repCountBefore: number } {
  const repCountBefore = repRows.length
  const nameToId = new Map<string, number>()
  repRows.forEach((row, id) => {
    const n = displayedNameOf(row)
    if (n && !nameToId.has(n)) nameToId.set(n, id)
  })
  const merged = repRows.map(r => r.slice())
  const remap = memberRows.map(row => {
    const n = displayedNameOf(row)
    if (n && nameToId.has(n)) return nameToId.get(n)!
    const newId = merged.length
    merged.push(row.slice())
    if (n) nameToId.set(n, newId)
    return newId
  })
  return { merged, remap, repCountBefore }
}

/**
 * Remap a segment's nested-AOI id fields (from offset 3 onward) through
 * `lookup`; ids the lookup returns `undefined` for are left as-is. Shared by
 * BOTH directions — the fold (member-local → merged, array lookup) and the
 * un-fold (merged → member-local, Map lookup) — so the nested-segment field
 * offset lives in exactly one place and the two remaps can never drift.
 */
const remapSegAois = (
  seg: number[],
  lookup: (id: number) => number | undefined
): number[] => {
  const out = seg.slice()
  for (let k = 3; k < out.length; k++) {
    const mapped = lookup(out[k])
    if (mapped !== undefined) out[k] = mapped
  }
  return out
}

const invertRemap = (remap: number[]): Map<number, number> => {
  // merged-id -> member-local id. On a many-to-one (member had two same-named
  // entries) the lowest member-local id wins — the entries are logically
  // identical, so the restore is logically-equivalent (documented in the plan).
  const inv = new Map<number, number>()
  for (let j = remap.length - 1; j >= 0; j--) inv.set(remap[j], j)
  return inv
}

const cloneRows2 = (d: string[][][]): string[][][] =>
  d.map(stim => stim.map(r => r.slice()))

/**
 * Merge `memberIds` into `representativeId` on the stimulus axis, operating on
 * the nested working form (segments already deserialized). The binary boundary
 * lives in the {@link mergeStimuli} wrapper / `foldMerges`.
 *
 * TAKES OWNERSHIP of `data`'s segment / spatial / event buffers, folding them
 * IN PLACE — every caller passes a freshly-converted, solely-owned
 * {@link NestedDataset}. The small per-stimulus dictionaries are still copied
 * (cheap, and the reconciliation appends to them).
 */
export function foldStimulusMergeDataset(
  data: NestedDataset,
  representativeId: number,
  memberIds: number[],
  at: number
): NestedDataset {
  const segs = data.segments
  const spat = data.spatialData

  const aoisData = cloneRows2(data.aois.data)
  const aoiOrder = data.aois.orderVector.map(o => o.slice())
  const chanData = cloneRows2(data.eventData.data)
  const chanOrder = data.eventData.orderVector.map(o => o.slice())
  const events = data.eventData.events ?? []

  const members: MergeMember[] = memberIds.map(memberId => {
    // --- AOI dictionary reconciliation ---
    const aoi = reconcileDict(aoisData[representativeId] ?? [], aoisData[memberId] ?? [])
    aoisData[representativeId] = aoi.merged
    for (let id = aoi.repCountBefore; id < aoi.merged.length; id++) {
      ;(aoiOrder[representativeId] ??= []).push(id)
    }

    // --- Event-channel dictionary reconciliation ---
    const chan = reconcileDict(chanData[representativeId] ?? [], chanData[memberId] ?? [])
    chanData[representativeId] = chan.merged
    for (let id = chan.repCountBefore; id < chan.merged.length; id++) {
      ;(chanOrder[representativeId] ??= []).push(id)
    }

    // --- Segments: move member's participant cells into the rep, remap AOI ids ---
    const contributedCounterparts: number[] = []
    const repStim = segs[representativeId] ?? []
    const memStim = segs[memberId] ?? []
    const participantCount = Math.max(repStim.length, memStim.length)
    for (let p = 0; p < participantCount; p++) {
      const memberCell = memStim[p] ?? []
      if (memberCell.length === 0) continue
      const repCell = repStim[p] ?? []
      if (repCell.length > 0) {
        throw new Error(
          `mergeStimuli: overlap on participant ${p} — stimulus ${representativeId} and ${memberId} both have segments; a merge must be disjoint`
        )
      }
      while (repStim.length <= p) repStim.push([])
      repStim[p] = memberCell.map(s => remapSegAois(s, id => aoi.remap[id]))
      memStim[p] = []
      if (spat) {
        const repSp = spat[representativeId] ?? []
        const memSp = spat[memberId] ?? []
        while (repSp.length <= p) repSp.push([])
        repSp[p] = memSp[p] ?? []
        if (memSp[p]) memSp[p] = []
        spat[representativeId] = repSp
        spat[memberId] = memSp
      }
      contributedCounterparts.push(p)
    }
    segs[representativeId] = repStim
    segs[memberId] = memStim

    // --- Events: move member's (channel, participant) buffers into the rep ---
    const stimulusEventContributions: {
      memberChannel: number
      participant: number
      boundary: number
    }[] = []
    const repEv = (events[representativeId] ??= [])
    const memEv = events[memberId] ?? []
    for (let c = 0; c < memEv.length; c++) {
      const repChannel = chan.remap[c]
      const memChan = memEv[c] ?? []
      while (repEv.length <= repChannel) repEv.push([])
      const repChan = repEv[repChannel]
      for (let p = 0; p < memChan.length; p++) {
        const memberBuf = memChan[p] ?? []
        if (memberBuf.length === 0) continue
        const repBuf = repChan[p] ?? []
        const boundary = repBuf.length
        while (repChan.length <= p) repChan.push([])
        repChan[p] = repBuf.concat(memberBuf)
        memChan[p] = []
        stimulusEventContributions.push({ memberChannel: c, participant: p, boundary })
      }
    }

    return {
      id: memberId,
      displayedName: displayedNameOf(data.stimuli.data[memberId]),
      orderIndex: data.stimuli.orderVector.indexOf(memberId),
      contributedCounterparts,
      aoiDictRemap: { remap: aoi.remap, repCountBefore: aoi.repCountBefore },
      channelDictRemap: { remap: chan.remap, repCountBefore: chan.repCountBefore },
      ...(stimulusEventContributions.length ? { stimulusEventContributions } : {}),
    }
  })

  const memberSet = new Set(memberIds)
  const stimuliOrder = data.stimuli.orderVector.filter(id => !memberSet.has(id))

  const entry: MergeLogEntry = {
    op: 'merge',
    axis: 'stimulus',
    representativeId,
    members,
    at,
  }

  return {
    ...data,
    stimuli: { ...data.stimuli, orderVector: stimuliOrder },
    aois: { ...data.aois, data: aoisData, orderVector: aoiOrder },
    eventData: {
      ...data.eventData,
      data: chanData,
      orderVector: chanOrder,
      events,
    },
    // `segments` / `spatialData` were folded in place — `...data` carries them.
    merges: [...(data.merges ?? []), entry],
  }
}

/** Exact inverse of {@link foldStimulusMergeDataset} (nested working form). */
export function unfoldStimulusMergeDataset(
  data: NestedDataset,
  entry: MergeLogEntry
): NestedDataset {
  // Takes ownership of the segment / spatial / event buffers (unfolds in place).
  const segs = data.segments
  const spat = data.spatialData
  const aoisData = cloneRows2(data.aois.data)
  const aoiOrder = data.aois.orderVector.map(o => o.slice())
  const chanData = cloneRows2(data.eventData.data)
  const chanOrder = data.eventData.orderVector.map(o => o.slice())
  const events = data.eventData.events ?? []
  const rep = entry.representativeId

  // Reverse member order so nested dictionary appends unwind correctly (LIFO).
  for (const member of [...entry.members].reverse()) {
    const memberId = member.id

    // --- Events back to the member ---
    const repEv = events[rep] ?? []
    const memEv = (events[memberId] ??= [])
    // Two member channels with the same displayed name reconcile to ONE rep
    // channel, stacking both onto one cell — unwind LIFO here too, like the
    // (already reversed) outer member loop does for the cross-member case.
    for (const { memberChannel, participant, boundary } of [
      ...(member.stimulusEventContributions ?? []),
    ].reverse()) {
      const repChannel = member.channelDictRemap!.remap[memberChannel]
      const repChan = repEv[repChannel] ?? []
      const repBuf = repChan[participant] ?? []
      while (memEv.length <= memberChannel) memEv.push([])
      const memChan = memEv[memberChannel]
      while (memChan.length <= participant) memChan.push([])
      memChan[participant] = repBuf.slice(boundary)
      repChan[participant] = repBuf.slice(0, boundary)
    }

    // --- Segments back to the member, un-remapping AOI ids ---
    // Inverse of the member-local -> merged remap (merged-id -> member-local id;
    // lowest member-local wins on a many-to-one, per invertRemap's contract).
    const inv = invertRemap(member.aoiDictRemap?.remap ?? [])
    const repStim = segs[rep] ?? []
    const memStim = (segs[memberId] ??= [])
    for (const p of member.contributedCounterparts) {
      const repCell = repStim[p] ?? []
      while (memStim.length <= p) memStim.push([])
      memStim[p] = repCell.map(seg => remapSegAois(seg, id => inv.get(id)))
      repStim[p] = []
      if (spat) {
        const repSp = spat[rep] ?? []
        const memSp = (spat[memberId] ??= [])
        while (memSp.length <= p) memSp.push([])
        memSp[p] = repSp[p] ?? []
        if (repSp[p]) repSp[p] = []
      }
    }

    // --- Shrink the rep dictionaries back + restore the member into orderVector ---
    if (member.aoiDictRemap) {
      aoisData[rep] = (aoisData[rep] ?? []).slice(0, member.aoiDictRemap.repCountBefore)
      aoiOrder[rep] = (aoiOrder[rep] ?? []).filter(id => id < member.aoiDictRemap!.repCountBefore)
    }
    if (member.channelDictRemap) {
      chanData[rep] = (chanData[rep] ?? []).slice(0, member.channelDictRemap.repCountBefore)
      chanOrder[rep] = (chanOrder[rep] ?? []).filter(id => id < member.channelDictRemap!.repCountBefore)
    }
  }

  return {
    ...data,
    stimuli: {
      ...data.stimuli,
      orderVector: restoreOrderVector(data.stimuli.orderVector, entry.members),
    },
    aois: { ...data.aois, data: aoisData, orderVector: aoiOrder },
    eventData: {
      ...data.eventData,
      data: chanData,
      orderVector: chanOrder,
      events,
    },
    // `segments` / `spatialData` were folded in place — `...data` carries them.
    merges: dropMergeEntry(data.merges, entry),
  }
}

/**
 * DataType-level stimulus merge (binary boundary): {@link foldStimulusMergeDataset}
 * wrapped in a single binary→nested→binary conversion, preserving the
 * `DataType → DataType` contract every caller and test relies on.
 */
export const mergeStimuli = (
  data: DataType,
  representativeId: number,
  memberIds: number[],
  at: number
): DataType =>
  fromNested(
    foldStimulusMergeDataset(toNested(data), representativeId, memberIds, at)
  )

/** Exact inverse of {@link mergeStimuli} (binary boundary). */
export const unmergeStimuli = (data: DataType, entry: MergeLogEntry): DataType =>
  fromNested(unfoldStimulusMergeDataset(toNested(data), entry))
