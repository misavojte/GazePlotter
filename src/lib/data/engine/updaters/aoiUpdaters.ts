import { type ExtendedInterpretedDataType } from '$lib/data/types'
import type { DataEngine } from '../DataEngine.svelte'
import { getAoiRaw } from '../utils/interpreters'

/**
 * Updates multiple AOIs for a stimulus with optional propagation to other stimuli.
 */
export const updateMultipleAoi = (
  engine: DataEngine,
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
    const originalNameToValues =
      applyTo === 'all_by_original_name'
        ? new Map(
            aois.map(a => [
              a.originalName,
              { displayedName: a.displayedName, color: a.color },
            ])
          )
        : null

    const displayedNameToColor =
      applyTo === 'all_by_displayed_name'
        ? new Map(
            aois
              .map(a => {
                const dName = a.displayedName || a.originalName
                return dName.trim() ? [dName, a.color] as const : null
              })
              .filter((x): x is [string, string] => x !== null)
          )
        : null

    const otherUpdates = Array.from({ length: meta.stimuli.data.length })
      .map((_, sId) => {
        const stimAois = meta.aois.data[sId]
        if (!stimAois) return null

        if (sId === stimulusId) {
          return { stimulusId: sId, aois }
        }

        let modified = false
        const nextAois = stimAois.map((_, aId) => {
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
          return aoi
        })

        return modified ? { stimulusId: sId, aois: nextAois } : null
      })
      .filter(
        (x): x is { stimulusId: number; aois: ExtendedInterpretedDataType[] } =>
          x !== null
      )

    updates.push(...otherUpdates)
  }

  if (updates.length > 0) engine.updateAoisBatch(updates)
}

/**
 * Updates hidden AOIs for a stimulus.
 */
export const updateHiddenAois = (
  engine: DataEngine,
  stimulusId: number,
  hiddenAois: number[]
): void => {
  engine.setHiddenAois(stimulusId, hiddenAois)
}

/**
 * Updates hidden AOIs for a stimulus and propagates the status.
 */
export const updateHiddenAoisWithPropagation = (
  engine: DataEngine,
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

  const keysToHide = new Set(
    unique
      .map(idx => sourceAois[idx])
      .filter((row): row is [string, string | undefined] => row !== undefined)
      .map(row =>
        applyTo === 'all_by_original_name' ? row[0] : (row[1] ?? row[0]).trim()
      )
      .filter(key => key !== '')
  )

  const propagationUpdates = Array.from({ length: meta.stimuli.data.length })
    .map((_, sId) => {
      if (sId === stimulusId) return null
      const stimAois = meta.aois.data[sId]
      if (!stimAois) return null

      const nextHidden = stimAois
        .map((row, aId) => {
          const key =
            applyTo === 'all_by_original_name'
              ? row[0]
              : (row[1] ?? row[0]).trim()
          return key && keysToHide.has(key) ? aId : null
        })
        .filter((aId): aId is number => aId !== null)

      return { stimulusId: sId, hiddenAois: nextHidden }
    })
    .filter(
      (upd): upd is { stimulusId: number; hiddenAois: number[] } => upd !== null
    )

  updates.push(...propagationUpdates)

  engine.updateHiddenAoisBatch(updates)
}
