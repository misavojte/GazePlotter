import {
  ALL_SELECTION_LABEL,
  type EntitySelection,
  type NameSelection,
  type ParticipantsSelection,
  type BaseInterpretedDataType,
} from '$lib/data/types'
import type { DataEngine } from '../dataEngine.svelte'
import type { GroupedByDisplayedName } from '../utils/grouping'
import {
  getParticipant,
  getAllParticipants,
  getParticipantOrderVector,
  getStimuli,
} from './entitySelectors'
import { getNumberOfSegments } from './segmentSelectors'

const getNonEmptyParticipants = (
  engine: DataEngine,
  stimulusId: number
): BaseInterpretedDataType[] => {
  return getParticipantOrderVector(engine)
    .filter(id => getNumberOfSegments(engine, stimulusId, id) > 0)
    .map(id => getParticipant(engine, id))
}

export const getParticipantsSelections = (
  engine: DataEngine,
  isDefault = false,
  stimulusId = 0
): ParticipantsSelection[] => {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')

  const defaultSelections: ParticipantsSelection[] = isDefault
    ? [
        {
          id: -1,
          name: ALL_SELECTION_LABEL,
          participantsIds: getParticipantOrderVector(engine),
        },
        {
          id: -2,
          name: 'Non-empty',
          participantsIds: getNonEmptyParticipants(engine, stimulusId).map(p => p.id),
        },
      ]
    : []

  return [...defaultSelections, ...meta.participantsSelections]
}

// Unknown id resolves to null and callers fall back to All participants —
// same self-healing contract as AOI selections (resolveAoiSelectionVisibleIds):
// deleting a selection a plot still points at must not throw the plot.
export const getStimuliSelections = (engine: DataEngine): EntitySelection[] =>
  engine.metadata?.stimuliSelections ?? []

export const getCategoriesSelections = (engine: DataEngine): EntitySelection[] =>
  engine.metadata?.categoriesSelections ?? []

/**
 * Resolve a per-plot `categorySelectionId` to the raw set of category ids the
 * selection holds. Returns `null` for "All"/unset/unknown selection, meaning
 * NO narrowing — the same self-healing contract as
 * resolveAoiSelectionVisibleIds. Plots narrowing displayed-name groups go
 * through applyCategorySelection below rather than this raw set.
 */
export const resolveCategorySelectionMemberIds = (
  engine: DataEngine,
  categorySelectionId: number | undefined
): Set<number> | null => {
  if (categorySelectionId == null || categorySelectionId <= 0) return null
  const selection = getCategoriesSelections(engine).find(
    s => s.id === categorySelectionId
  )
  if (!selection) return null
  return new Set(selection.memberIds)
}

/**
 * Apply a per-plot eye-movement-type SELECTION to displayed-name groups.
 * A whole group is KEPT when ANY member id is held by the selection (the
 * modal commits complete groups — this heals regroups made since); every
 * member of a dropped group lands in `narrowedAwayIds` so callers can treat
 * those categories exactly like globally hidden ones. Unset/unknown selection
 * keeps everything (self-healing, as above). This is the single definition of
 * the narrowing policy — plots must not re-derive it from the raw member set.
 */
export const applyCategorySelection = <G extends GroupedByDisplayedName<unknown>>(
  engine: DataEngine,
  groups: G[],
  categorySelectionId: number | undefined
): { kept: G[]; narrowedAwayIds: number[] } => {
  const heldIds = resolveCategorySelectionMemberIds(engine, categorySelectionId)
  if (!heldIds) return { kept: groups, narrowedAwayIds: [] }
  const kept: G[] = []
  const narrowedAwayIds: number[] = []
  for (const g of groups) {
    if (g.memberIds.some(id => heldIds.has(id))) kept.push(g)
    else narrowedAwayIds.push(...g.memberIds)
  }
  return { kept, narrowedAwayIds }
}

export const getEventsSelections = (engine: DataEngine): NameSelection[] =>
  engine.metadata?.eventsSelections ?? []

/**
 * Stimuli a plot ranges over under a stimulus selection. Unset/0 or an
 * unknown id resolves to ALL stimuli (self-healing, like AOI selections);
 * order follows the stimulus display order and merged-away ids drop out.
 */
export const getStimuliInSelection = (
  engine: DataEngine,
  selectionId?: number
): BaseInterpretedDataType[] => {
  const all = getStimuli(engine)
  if (!selectionId) return all
  const selection = getStimuliSelections(engine).find(s => s.id === selectionId)
  if (!selection) return all
  const memberSet = new Set(selection.memberIds)
  return all.filter(s => memberSet.has(s.id))
}

const getParticipantsSelection = (
  engine: DataEngine,
  groupId: number
): ParticipantsSelection | null =>
  getParticipantsSelections(engine).find(g => g.id === groupId) ?? null

/**
 * Get all participants of given group ID.
 */
export const getParticipants = (
  engine: DataEngine,
  groupId = -1,
  stimulusId = 0
): BaseInterpretedDataType[] => {
  if (groupId === -1) return getAllParticipants(engine)
  if (groupId === -2) return getNonEmptyParticipants(engine, stimulusId)

  const group = getParticipantsSelection(engine, groupId)
  if (!group) return getAllParticipants(engine)
  const groupSet = new Set(group.participantsIds)

  return getParticipantOrderVector(engine)
    .filter(id => groupSet.has(id))
    .map(id => getParticipant(engine, id))
}

export const getParticipantsIds = (
  engine: DataEngine,
  groupId = -1,
  stimulusId = 0
): number[] => {
  if (groupId === -1) return getParticipantOrderVector(engine)
  if (groupId === -2) {
    return getNonEmptyParticipants(engine, stimulusId).map(p => p.id)
  }
  const group = getParticipantsSelection(engine, groupId)
  if (!group) return getParticipantOrderVector(engine)
  // Resolve through the order vector like getParticipants: stored groups may
  // hold merged-away (tombstoned) member ids for unmerge-reversibility, and
  // feeding those raw to plot transformers renders ghost participants.
  const groupSet = new Set(group.participantsIds)
  return getParticipantOrderVector(engine).filter(id => groupSet.has(id))
}

