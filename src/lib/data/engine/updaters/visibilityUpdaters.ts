import type { DataEngine } from '../DataEngine.svelte'

/**
 * Updates the visibility status of multiple AOIs.
 */
export const updateMultipleAoiVisibility = (
  engine: DataEngine,
  stimulusId: number,
  aoiNames: string[],
  visibilityArr: number[][],
  participantId: number | null = null
): void => {
  const meta = engine.metadata
  if (!meta) return
  const aoiData = meta.aois.data[stimulusId]
  if (!aoiData) {
    throw new Error(`No AOI data found for stimulusId: ${stimulusId}`)
  }

  const updates: {
    aoiId: number
    visibility: number[]
    participantId?: number | null
  }[] = []
  const missingAoiNames: string[] = []

  for (let i = 0; i < aoiNames.length; i++) {
    const name = aoiNames[i]
    let aoiId = -1
    for (let j = 0; j < aoiData.length; j++) {
      const [originalName, displayedName] = aoiData[j]
      if (originalName === name || displayedName === name) {
        aoiId = j
        break
      }
    }

    if (aoiId === -1) {
      missingAoiNames.push(name)
      continue
    }
    updates.push({ aoiId, visibility: visibilityArr[i], participantId })
  }

  if (missingAoiNames.length > 0) {
    throw new Error(
      `AOI visibility update references unknown AOIs for stimulusId ${stimulusId}: ${missingAoiNames.join(', ')}`
    )
  }

  if (updates.length > 0) {
    engine.updateDynamicVisibility(stimulusId, updates)
  }
}
