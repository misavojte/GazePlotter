import type { DataEngine } from '../dataEngine.svelte'

export const getNumberOfParticipants = (engine: DataEngine): number => {
  const meta = engine.metadata
  if (!meta) throw new Error('Data engine metadata not available')
  return meta.participants.data.length
}
