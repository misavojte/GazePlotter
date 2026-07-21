import { type BaseInterpretedDataType } from '$lib/data/types'
import type { DataEngine } from '../dataEngine.svelte'

/**
 * Stimuli and participants are the same `[originalName, displayedName]`-row
 * table behind an order vector, so these two generics are the single definition
 * of "resolve display order" and "id → interpreted entity" for both axes; the
 * public per-axis selectors below are one-line bindings over them.
 */
type EntityTable = 'stimuli' | 'participants'

const getEntityOrderVector = (
  engine: DataEngine,
  table: EntityTable
): number[] => {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')
  const { orderVector, data } = meta[table]
  return orderVector.length > 0
    ? orderVector
    : Array.from({ length: data.length }, (_, i) => i)
}

const getEntity = (
  engine: DataEngine,
  table: EntityTable,
  id: number
): BaseInterpretedDataType => {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')
  const row = meta[table].data[id]
  if (!row) {
    throw new Error(
      `${table === 'stimuli' ? 'Stimulus' : 'Participant'} with this id does not exist`
    )
  }
  const originalName = row[0]
  return { id, originalName, displayedName: row[1] ?? originalName }
}

const getStimuliOrderVector = (engine: DataEngine): number[] =>
  getEntityOrderVector(engine, 'stimuli')

export const getParticipantOrderVector = (engine: DataEngine): number[] =>
  getEntityOrderVector(engine, 'participants')

export const getStimulus = (
  engine: DataEngine,
  id: number
): BaseInterpretedDataType => getEntity(engine, 'stimuli', id)

export const getParticipant = (
  engine: DataEngine,
  id: number
): BaseInterpretedDataType => getEntity(engine, 'participants', id)

export const getStimuli = (engine: DataEngine): BaseInterpretedDataType[] =>
  getStimuliOrderVector(engine).map(id => getStimulus(engine, id))

export const getAllParticipants = (
  engine: DataEngine
): BaseInterpretedDataType[] =>
  getParticipantOrderVector(engine).map(id => getParticipant(engine, id))

/**
 * Full entity list for the modification modal: every visible entity plus, right
 * after each surviving representative, the members it currently absorbs (their
 * tombstoned rows). Merged members are shown under the survivor's displayed
 * name, so an active merge renders as a displayed-name group the user can see
 * and split apart. The plain `getStimuli`/`getAllParticipants` selectors return
 * the visible order only; these add the tombstoned members back for editing.
 */
const withMergedMembers = (
  engine: DataEngine,
  axis: 'stimulus' | 'participant',
  order: number[],
  get: (id: number) => BaseInterpretedDataType
): BaseInterpretedDataType[] => {
  const merges = (engine.metadata?.merges ?? []).filter(e => e.axis === axis)
  if (merges.length === 0) return order.map(get)

  const membersByRep = new Map<number, number[]>()
  for (const e of merges) {
    membersByRep.set(e.representativeId, [
      ...(membersByRep.get(e.representativeId) ?? []),
      ...e.members.map(m => m.id),
    ])
  }

  const out: BaseInterpretedDataType[] = []
  for (const id of order) {
    const survivor = get(id)
    out.push(survivor)
    // A merged member shares the survivor's logical identity, so it takes the
    // survivor's displayed name here (self-healing if the survivor was renamed
    // after merging) — that is what regroups it under the survivor.
    for (const memberId of membersByRep.get(id) ?? []) {
      out.push({ ...get(memberId), displayedName: survivor.displayedName })
    }
  }
  return out
}

export const getStimuliWithMerged = (
  engine: DataEngine
): BaseInterpretedDataType[] =>
  withMergedMembers(engine, 'stimulus', getStimuliOrderVector(engine), id =>
    getStimulus(engine, id)
  )

export const getParticipantsWithMerged = (
  engine: DataEngine
): BaseInterpretedDataType[] =>
  withMergedMembers(engine, 'participant', getParticipantOrderVector(engine), id =>
    getParticipant(engine, id)
  )
