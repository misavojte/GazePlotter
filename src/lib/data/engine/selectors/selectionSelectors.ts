import {
  FIXATION_CATEGORY_ID,
  type EntitySelection,
  type NameSelection,
  type ParticipantsSelection,
  type ParticipantScope,
  type BaseInterpretedDataType,
} from '$lib/data/types'
import type { DataEngine } from '../dataEngine.svelte'
import type { GroupedByDisplayedName } from '../utils/grouping'
import { getParticipantOrderVector, getStimuli } from './entitySelectors'
import { getNumberOfSegments, getParticipantEndTime } from './segmentSelectors'

export const getParticipantsSelections = (engine: DataEngine): ParticipantsSelection[] =>
  engine.metadata?.participantsSelections ?? []

// Unknown id resolves to null and callers fall back to All participants —
// same self-healing contract as AOI selections (resolveAoiSelectionVisibleIds):
// deleting a selection a plot still points at must not throw the plot.
export const getStimuliSelections = (engine: DataEngine): EntitySelection[] =>
  engine.metadata?.stimuliSelections ?? []

export const getCategoriesSelections = (engine: DataEngine): EntitySelection[] =>
  engine.metadata?.categoriesSelections ?? []

/**
 * Resolve a per-plot `categorySelectionId` to the raw set of category ids the
 * selection holds. `null` for "All"/unset/unknown means NO narrowing, the same
 * self-healing contract as resolveAoiSelectionVisibleIds.
 * The fixation baseline is a full member of the domain, and its reserved
 * displayed name keeps id 0 a singleton group, so consumers may gate the
 * fixation layer on raw membership of 0.
 * Plots narrowing displayed-name groups go through applyCategorySelection below.
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
 * member of a dropped group lands in `narrowedAwayIds` so callers can drop
 * those categories from their domain. Unset/unknown selection
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

/**
 * Whether a plot's fixation LAYER survives its eye-movement-type SELECTION.
 * The fixation baseline's reserved displayed name keeps id 0 a singleton
 * group, so raw membership IS the group decision — this helper is the one
 * blessed raw-set read, living beside the group policy so the two can't
 * drift. `null` resolution (All/unset/unknown) keeps the layer.
 */
export const fixationLayerVisible = (
  engine: DataEngine,
  categorySelectionId: number | undefined
): boolean => {
  const held = resolveCategorySelectionMemberIds(engine, categorySelectionId)
  return held === null || held.has(FIXATION_CATEGORY_ID)
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

/**
 * Participant ids a plot ranges over: the single narrowing policy. Unset/0 or
 * an unknown selection id means all (self-healing, like AOI selections). Stored
 * selections resolve through the order vector, since they may hold merged-away
 * ids that would render as ghost participants. `hideEmptyParticipants` then
 * drops those with no recording on the stimulus.
 */
export const getParticipantsIds = (
  engine: DataEngine,
  scope: ParticipantScope = {},
  stimulusId = 0
): number[] => {
  const order = getParticipantOrderVector(engine)
  const id = scope.participantSelectionId
  const selection = id ? getParticipantsSelections(engine).find(s => s.id === id) : undefined
  const memberSet = selection ? new Set(selection.participantsIds) : null
  if (!memberSet && !scope.hideEmptyParticipants) return order
  return order.filter(
    pid =>
      (!memberSet || memberSet.has(pid)) &&
      (!scope.hideEmptyParticipants ||
        getNumberOfSegments(engine, stimulusId, pid) > 0)
  )
}

/** Latest end time on a stimulus across the participants a plot ranges over. */
export const getParticipantsMaxEndTime = (
  engine: DataEngine,
  scope: ParticipantScope,
  stimulusId: number
): number =>
  Math.max(0, ...getParticipantsIds(engine, scope, stimulusId).map(id => getParticipantEndTime(engine, stimulusId, id)))
