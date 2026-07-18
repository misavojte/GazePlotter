import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { BaseInterpretedDataType } from '$lib/data/types'
import { detectMergeOverlap } from '$lib/data/merge/detectOverlap'
import { planDisplayedNameMerges } from '$lib/data/merge/planMerges'
import {
  createBaseGroupEditor,
  type MergeCard,
} from './groupedEntityEditor.svelte'

export interface MergeAxisMessages {
  /** Warn notice for a group whose recordings overlap on n counterparts. */
  conflict: (n: number) => string
  /** Info notice for a group that is already merged (only the survivor is new). */
  merged: string
  /** Info notice for a group that will merge on Apply. */
  willMerge: string
}

/**
 * Everything the stimulus and participant modals share about editing one
 * MERGE axis: the snapshot of merges active at open (so an active merge shows
 * grouped and can be split by renaming apart), live overlap validation, the
 * per-group notice, and the Apply-side planning that turns displayed-name
 * groups into merge commands while preserving `at` provenance for a group
 * that matches an active merge exactly.
 */
export function createMergeAxisEditor(
  engine: DataEngine,
  axis: 'stimulus' | 'participant',
  initialItems: BaseInterpretedDataType[],
  messages: MergeAxisMessages
) {
  // Snapshot of the merges active when the modal opened, on this axis. The
  // list is seeded with the members these merges absorbed (shown grouped
  // under their survivor) so an active merge is visible and splittable.
  const activeEntries = (engine.metadata?.merges ?? []).filter(
    e => e.axis === axis
  )
  const activeMergedIds = new Set(
    activeEntries.flatMap(e => e.members.map(m => m.id))
  )

  const editor = createBaseGroupEditor(initialItems, {
    detectConflicts: ids => {
      const reader = engine.getReader()
      if (!reader) return []
      // Members already merged in carry no overlap risk (they are already
      // folded); only a genuinely new member can conflict.
      const newMembers = ids.slice(1).filter(id => !activeMergedIds.has(id))
      if (newMembers.length === 0) return []
      return detectMergeOverlap(reader, axis, ids[0], newMembers)
    },
  })

  const notice = (group: MergeCard<BaseInterpretedDataType>) => {
    const conflicts = editor.conflictsFor(group)
    if (conflicts.length > 0) {
      return {
        tone: 'warn' as const,
        message: messages.conflict(conflicts.length),
        action: {
          label: 'Undo rename',
          onClick: () => editor.acknowledge(group),
        },
      }
    }
    // Only the survivor is new -> the rest are already merged in.
    const newMembers = group.members.filter(m => !activeMergedIds.has(m.id))
    return {
      tone: 'info' as const,
      message: newMembers.length <= 1 ? messages.merged : messages.willMerge,
    }
  }

  const itemsSignature = (items: BaseInterpretedDataType[]): string =>
    JSON.stringify(items.map(i => [i.id, (i.displayedName || '').trim()]))
  const itemsSnapshot = itemsSignature(initialItems)

  /** Rename/merge step only when the list actually changed — Apply may mean
      a selections-only edit, which must not push a merge undo step. */
  const itemsChanged = (items: BaseInterpretedDataType[]) =>
    itemsSignature(items) !== itemsSnapshot

  const sameIdSet = (a: number[], b: number[]) =>
    a.length === b.length && new Set([...a, ...b]).size === a.length

  /** Displayed-name merge groups for Apply, reusing the open-time `at` for a
      group that matches an active merge exactly (provenance stays stable). */
  const planGroups = (items: BaseInterpretedDataType[]) =>
    planDisplayedNameMerges(items).map(g => {
      const existing = activeEntries.find(
        e =>
          e.representativeId === g.representativeId &&
          sameIdSet(
            e.members.map(m => m.id),
            g.memberIds
          )
      )
      return {
        representativeId: g.representativeId,
        memberIds: g.memberIds,
        at: existing?.at ?? Date.now(),
      }
    })

  return { editor, notice, itemsChanged, planGroups }
}
