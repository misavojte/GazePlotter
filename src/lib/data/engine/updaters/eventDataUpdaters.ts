import type { DataEngine } from '../DataEngine.svelte'

/**
 * Updates event channels and their event buffers for a stimulus.
 * Called by the command handler.
 */
export const updateEventData = (
  engine: DataEngine,
  stimulusId: number,
  channelDefs: string[][],
  eventBuffers: number[][][]
): void => {
  engine.updateEventDataBatch([{ stimulusId, channelDefs, eventBuffers }])
}
