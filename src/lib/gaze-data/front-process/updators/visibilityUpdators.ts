import { engine } from '../stores/dataStore.svelte'

/**
 * Updates the visibility status of multiple AOIs.
 */
export const updateMultipleAoiVisibility = (
  stimulusId: number,
  aoiNames: string[],
  visibilityArr: number[][],
  participantId: number | null = null
): void => {
  const meta = engine.metadata
  if (!meta) return
  const aoiData = meta.aois.data[stimulusId]
  if (!aoiData) {
    console.error(`No AOI data found for stimulusId: ${stimulusId}`)
    return
  }

  const updates: {
    aoiId: number
    visibility: number[]
    participantId?: number | null
  }[] = []

  for (let i = 0; i < aoiNames.length; i++) {
    const name = aoiNames[i]
    let aoiId = -1
    for (let j = 0; j < aoiData.length; j++) {
      if (aoiData[j][0] === name) {
        aoiId = j
        break
      }
    }

    if (aoiId === -1) {
      console.warn(
        `AOI with name ${name} not found for stimulusId: ${stimulusId}`
      )
      continue
    }
    updates.push({ aoiId, visibility: visibilityArr[i], participantId })
  }

  if (updates.length > 0) {
    engine.updateDynamicVisibility(stimulusId, updates)
  }
}
