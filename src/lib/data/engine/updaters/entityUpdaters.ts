import { type BaseInterpretedDataType } from '$lib/data/types'
import type { DataEngine } from '../dataEngine.svelte'

/**
 * Update multiple `[originalName, displayedName]`-row entities and their display
 * order for one axis. Stimuli and participants share the same table shape, so
 * one implementation serves both; the named exports are one-line bindings.
 */
const updateMultipleEntities = (
  engine: DataEngine,
  table: 'stimuli' | 'participants',
  entities: BaseInterpretedDataType[]
): void => {
  const meta = engine.metadata
  if (!meta) return

  const updates = entities
    .filter(e => e.id >= 0 && e.id < meta[table].data.length)
    .map(e => ({ id: e.id, data: [e.originalName, e.displayedName] }))
  engine.updateEntityBatch(table, updates, entities.map(e => e.id))
}

export const updateMultipleParticipants = (
  engine: DataEngine,
  participants: BaseInterpretedDataType[]
): void => updateMultipleEntities(engine, 'participants', participants)

export const updateMultipleStimuli = (
  engine: DataEngine,
  stimuli: BaseInterpretedDataType[]
): void => updateMultipleEntities(engine, 'stimuli', stimuli)
