import type { ExtendedInterpretedDataType } from '$lib/data/types'
import type { DataEngine } from '../dataEngine.svelte'

/**
 * Updates event channels and their event buffers for a stimulus.
 * Called by the command handler.
 */
export const updateEventData = (
  engine: DataEngine,
  stimulusId: number,
  channelDefs: string[][],
  eventBuffers: number[][][],
  orderVector?: number[]
): void => {
  engine.updateEventDataBatch([
    {
      stimulusId,
      channelDefs,
      eventBuffers,
      ...(orderVector !== undefined ? { orderVector } : {}),
    },
  ])
}

/**
 * Updates event channel metadata (names, colors, order) for a stimulus.
 * Does not modify event buffers.
 */
export const updateEventChannels = (
  engine: DataEngine,
  channels: ExtendedInterpretedDataType[],
  stimulusId: number
): void => {
  engine.updateEventChannelsBatch([{ stimulusId, channels }])
}

/**
 * Updates hidden event channels for a stimulus.
 */
export const updateHiddenEventChannels = (
  engine: DataEngine,
  stimulusId: number,
  hiddenChannels: number[]
): void => {
  engine.setHiddenEventChannels(stimulusId, hiddenChannels)
}
