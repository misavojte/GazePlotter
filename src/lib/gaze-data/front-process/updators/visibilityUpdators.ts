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
  const currentState = engine.metadata
  if (!currentState) return
  const aoiData = currentState.aois.data[stimulusId]
  if (aoiData === undefined) {
    console.error(`No AOI data found for stimulusId: ${stimulusId}`)
    return
  }

  const updates: {
    aoiId: number
    visibility: number[]
    participantId?: number | null
  }[] = []

  aoiNames.forEach((aoiName, index) => {
    const aoiId = aoiData.findIndex(el => el[0] === aoiName)
    if (aoiId === -1) {
      console.warn(
        `AOI with name ${aoiName} not found for stimulusId: ${stimulusId}`
      )
      return
    }
    updates.push({ aoiId, visibility: visibilityArr[index], participantId })
  })

  if (updates.length > 0) {
    engine.updateDynamicVisibility(stimulusId, updates)
  }
}
