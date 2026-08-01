import {
  ALL_SELECTION_LABEL,
  FIXATION_CATEGORY_ID,
  NONE_SELECTION_ID,
  type EntitySelection,
  type NameSelection,
  type ParticipantsSelection,
  type BaseInterpretedDataType,
} from '$lib/data/types'
import type { DataEngine } from '../dataEngine.svelte'
import type { GroupedByDisplayedName } from '../utils/grouping'
import {
  getParticipant,
  getParticipantOrderVector,
  getStimuli,
} from './entitySelectors'
import { getNumberOfSegments } from './segmentSelectors'

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
          participantsIds: getParticipantsIds(engine, -2, stimulusId),
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
 * resolveAoiSelectionVisibleIds. The built-in "None" resolves to the empty
 * set: every type is narrowed away, the fixation baseline included (id 0
 * joined the SELECTION domain; its reserved displayed name keeps it a
 * singleton group, so consumers may gate the fixation layer on raw
 * membership of id 0). Plots narrowing displayed-name groups go through
 * applyCategorySelection below rather than this raw set.
 */
export const resolveCategorySelectionMemberIds = (
  engine: DataEngine,
  categorySelectionId: number | undefined
): Set<number> | null => {
  if (categorySelectionId === NONE_SELECTION_ID) return new Set()
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
  selectionId: number
): ParticipantsSelection | null =>
  getParticipantsSelections(engine).find(s => s.id === selectionId) ?? null

/**
 * Participant ids a plot ranges over under a participants SELECTION — the
 * single definition of the narrowing policy. `-1` = all, `-2` = non-empty for
 * the stimulus, otherwise the stored selection resolved through the order
 * vector: stored selections may hold merged-away (tombstoned) member ids for
 * unmerge-reversibility, and feeding those raw to plot transformers renders
 * ghost participants. Unknown ids self-heal to all participants.
 */
export const getParticipantsIds = (
  engine: DataEngine,
  selectionId = -1,
  stimulusId = 0
): number[] => {
  const order = getParticipantOrderVector(engine)
  if (selectionId === -2)
    return order.filter(id => getNumberOfSegments(engine, stimulusId, id) > 0)
  if (selectionId === -1) return order
  const selection = getParticipantsSelection(engine, selectionId)
  if (!selection) return order
  const memberSet = new Set(selection.participantsIds)
  return order.filter(id => memberSet.has(id))
}

/** {@link getParticipantsIds}, resolved to the participant rows. */
export const getParticipants = (
  engine: DataEngine,
  selectionId = -1,
  stimulusId = 0
): BaseInterpretedDataType[] =>
  getParticipantsIds(engine, selectionId, stimulusId).map(id =>
    getParticipant(engine, id)
  )

