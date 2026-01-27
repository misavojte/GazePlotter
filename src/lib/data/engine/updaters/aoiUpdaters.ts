import { type ExtendedInterpretedDataType } from '$lib/data/types'
import { engine } from '../DataEngine.svelte'
import { getAoiRaw } from '../utils/interpreters'

/**
 * Updates multiple AOIs for a stimulus with optional propagation to other stimuli.
 */
export const updateMultipleAoi = (
  aois: ExtendedInterpretedDataType[],
  stimulusId: number,
  applyTo: 'this_stimulus' | 'all_by_original_name' | 'all_by_displayed_name'
): void => {
  const meta = engine.metadata
  if (!meta || !meta.aois.data[stimulusId]) return

  const updates: { stimulusId: number; aois: ExtendedInterpretedDataType[] }[] =
    []

  if (applyTo === 'this_stimulus') {
    updates.push({ stimulusId, aois })
  } else {
    const numStimuli = meta.stimuli.data.length
    const originalNameToValues =
      applyTo === 'all_by_original_name'
        ? new Map<string, { displayedName: string; color: string }>()
        : null
    const displayedNameToColor =
      applyTo === 'all_by_displayed_name' ? new Map<string, string>() : null

    for (let i = 0; i < aois.length; i++) {
      const a = aois[i]
      if (originalNameToValues) {
        originalNameToValues.set(a.originalName, {
          displayedName: a.displayedName,
          color: a.color,
        })
      } else if (displayedNameToColor) {
        const dName = a.displayedName || a.originalName
        if (dName.trim()) displayedNameToColor.set(dName, a.color)
      }
    }

    for (let sId = 0; sId < numStimuli; sId++) {
      const stimAois = meta.aois.data[sId]
      if (!stimAois) continue

      if (sId === stimulusId) {
        updates.push({ stimulusId: sId, aois })
        continue
      }

      const nextAois: ExtendedInterpretedDataType[] = []
      let modified = false

      for (let aId = 0; aId < stimAois.length; aId++) {
        const aoi = getAoiRaw(sId, aId, meta)
        if (originalNameToValues) {
          const vals = originalNameToValues.get(aoi.originalName)
          if (vals) {
            aoi.displayedName = vals.displayedName
            aoi.color = vals.color
            modified = true
          }
        } else if (displayedNameToColor) {
          const dName = aoi.displayedName || aoi.originalName
          const color = displayedNameToColor.get(dName)
          if (color) {
            aoi.color = color
            modified = true
          }
        }
        nextAois.push(aoi)
      }

      if (modified) updates.push({ stimulusId: sId, aois: nextAois })
    }
  }

  if (updates.length > 0) engine.updateAoisBatch(updates)
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
  const meta = engine.metadata
  if (!meta || !meta.aois.data[stimulusId]) return

  if (applyTo === 'this_stimulus') {
    engine.setHiddenAois(stimulusId, hiddenAois)
    return
  }

  const updates: { stimulusId: number; hiddenAois: number[] }[] = []

  const sourceAoisForFiltering = meta.aois.data[stimulusId]
  const unique = Array.from(
    new Set(
      hiddenAois.filter(
        v => Number.isInteger(v) && v >= 0 && v < sourceAoisForFiltering.length
      )
    )
  ).sort((a, b) => a - b)
  updates.push({ stimulusId, hiddenAois: unique })

  const keysToHide = new Set<string>()
  const sourceAois = meta.aois.data[stimulusId]

  for (let i = 0; i < unique.length; i++) {
    const row = sourceAois[unique[i]]
    if (!row) continue
    const key =
      applyTo === 'all_by_original_name' ? row[0] : (row[1] ?? row[0]).trim()
    if (key) keysToHide.add(key)
  }

  for (let sId = 0; sId < meta.stimuli.data.length; sId++) {
    if (sId === stimulusId) continue
    const stimAois = meta.aois.data[sId]
    if (!stimAois) continue

    const nextHidden: number[] = []
    for (let aId = 0; aId < stimAois.length; aId++) {
      const row = stimAois[aId]
      const key =
        applyTo === 'all_by_original_name' ? row[0] : (row[1] ?? row[0]).trim()
      if (key && keysToHide.has(key)) nextHidden.push(aId)
    }
    updates.push({ stimulusId: sId, hiddenAois: nextHidden })
  }

  engine.updateHiddenAoisBatch(updates)
}
