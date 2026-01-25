import {
  type ExtendedInterpretedDataType,
  type DataType,
} from '$lib/gaze-data/shared/types'
import { engine } from '../stores/dataStore.svelte'
import { MAX_AOI } from '../const'

/**
 * Internal helper to get all AOIs for a stimulus from a metadata snapshot.
 */
const getAoisRawFromMetadata = (
  stimulusId: number,
  metadata: Omit<DataType, 'segments'>
): ExtendedInterpretedDataType[] => {
  const order = metadata.aois.orderVector?.[stimulusId]
  const aoiIds = order ?? [
    ...Array(metadata.aois.data[stimulusId]?.length ?? 0).keys(),
  ]

  const COLORS = ['#66c5cc', '#f6cf71', '#f89c74', '#dCB0F2', '#87c55f']

  return aoiIds.map((aoiId: number) => {
    const row = metadata.aois.data[stimulusId][aoiId]
    const originalName = row[0]
    const displayedName = row[1] ?? originalName
    const color = row[2] ?? COLORS[aoiId % COLORS.length]
    return { id: aoiId, originalName, displayedName, color }
  })
}

/**
 * Updates multiple AOIs for a stimulus with optional propagation to other stimuli.
 */
export const updateMultipleAoi = (
  aois: ExtendedInterpretedDataType[],
  stimulusId: number,
  applyTo: 'this_stimulus' | 'all_by_original_name' | 'all_by_displayed_name'
): void => {
  const meta = engine.metadata
  if (!meta || !meta.aois.data[stimulusId]) {
    return
  }

  const updates: { stimulusId: number; aois: ExtendedInterpretedDataType[] }[] =
    []

  if (applyTo === 'this_stimulus') {
    let currentList = getAoisRawFromMetadata(stimulusId, meta)
    if (aois.length >= currentList.length) {
      currentList = aois
    } else {
      const updateMap = new Map(aois.map(a => [a.id, a]))
      currentList = currentList.map(a => {
        const update = updateMap.get(a.id)
        return update ? { ...a, ...update } : a
      })
    }
    updates.push({ stimulusId, aois: currentList })
  } else if (applyTo === 'all_by_original_name') {
    const originalNameToValues = new Map<
      string,
      { displayedName: string; color: string }
    >()
    aois.forEach(aoi => {
      originalNameToValues.set(aoi.originalName, {
        displayedName: aoi.displayedName,
        color: aoi.color,
      })
    })

    const numStimuli = meta.stimuli.data.length
    for (let sId = 0; sId < numStimuli; sId++) {
      let currentList = getAoisRawFromMetadata(sId, meta)
      let modified = false

      if (sId === stimulusId) {
        if (aois.length >= currentList.length) {
          currentList = aois
        } else {
          const updateMap = new Map(aois.map(a => [a.id, a]))
          currentList = currentList.map(a => {
            const update = updateMap.get(a.id)
            return update ? { ...a, ...update } : a
          })
        }
        modified = true
      } else {
        currentList = currentList.map(aoi => {
          const vals = originalNameToValues.get(aoi.originalName)
          if (vals) {
            modified = true
            return { ...aoi, ...vals }
          }
          return aoi
        })
      }

      if (modified) {
        updates.push({ stimulusId: sId, aois: currentList })
      }
    }
  } else if (applyTo === 'all_by_displayed_name') {
    const displayedNameToColor = new Map<string, string>()
    aois.forEach(aoi => {
      if (aoi.displayedName && aoi.displayedName.trim() !== '') {
        displayedNameToColor.set(aoi.displayedName, aoi.color)
      }
    })

    const numStimuli = meta.stimuli.data.length
    for (let sId = 0; sId < numStimuli; sId++) {
      let currentList = getAoisRawFromMetadata(sId, meta)
      let modified = false

      if (sId === stimulusId) {
        if (aois.length >= currentList.length) {
          currentList = aois
        } else {
          const updateMap = new Map(aois.map(a => [a.id, a]))
          currentList = currentList.map(a => {
            const update = updateMap.get(a.id)
            return update ? { ...a, ...update } : a
          })
        }
        modified = true
      } else {
        currentList = currentList.map(aoi => {
          const dName = aoi.displayedName || aoi.originalName
          const color = displayedNameToColor.get(dName)
          if (color) {
            modified = true
            return { ...aoi, color }
          }
          return aoi
        })
      }

      if (modified) {
        updates.push({ stimulusId: sId, aois: currentList })
      }
    }
  }

  if (updates.length > 0) {
    engine.updateAoisBatch(updates)
  }
}

/**
 * Updates hidden AOIs for a stimulus.
 */
export const updateHiddenAois = (
  stimulusId: number,
  hiddenAois: number[]
): void => {
  engine.setHiddenAois(stimulusId, hiddenAois)
}

/**
 * Updates hidden AOIs for a stimulus and propagates the status.
 */
export const updateHiddenAoisWithPropagation = (
  stimulusId: number,
  hiddenAois: number[],
  applyTo: 'this_stimulus' | 'all_by_original_name' | 'all_by_displayed_name'
): void => {
  const currentState = engine.metadata
  if (!currentState) return

  if (!currentState.aois.data[stimulusId]) {
    throw new Error(
      `Cannot update hidden AOIs: stimulus ${stimulusId} does not exist`
    )
  }

  const unique = Array.from(
    new Set(
      (hiddenAois ?? []).filter(
        v => Number.isInteger(v) && v >= 0 && v < MAX_AOI
      )
    )
  ).sort((a, b) => a - b)

  const updates: { stimulusId: number; hiddenAois: number[] }[] = []
  updates.push({ stimulusId, hiddenAois: unique })

  if (applyTo !== 'this_stimulus') {
    const sourceAois = currentState.aois.data[stimulusId]
    const keysToHide = new Set<string>()

    unique.forEach(id => {
      const row = sourceAois?.[id]
      if (!row) return
      const originalName = row[0] ?? ''
      const displayedName = (row[1] ?? originalName) as string
      const key =
        applyTo === 'all_by_original_name'
          ? originalName
          : (displayedName || originalName).trim()
      if (key) keysToHide.add(key)
    })

    for (
      let stimIndex = 0;
      stimIndex < currentState.stimuli.data.length;
      stimIndex++
    ) {
      if (stimIndex === stimulusId) continue
      const stimAois = currentState.aois.data[stimIndex]
      if (!stimAois) continue

      const nextHidden: number[] = []
      for (let aoiId = 0; aoiId < stimAois.length; aoiId++) {
        const row = stimAois[aoiId]
        if (!row) continue
        const originalName = row[0] ?? ''
        const displayedName = (row[1] ?? originalName) as string
        const key =
          applyTo === 'all_by_original_name'
            ? originalName
            : (displayedName || originalName).trim()
        if (key && keysToHide.has(key)) {
          nextHidden.push(aoiId)
        }
      }
      updates.push({ stimulusId: stimIndex, hiddenAois: nextHidden })
    }
  }

  engine.updateHiddenAoisBatch(updates)
}
