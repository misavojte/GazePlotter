import { type ExtendedInterpretedDataType } from '$lib/data/types'
import type { DataEngine } from '../dataEngine.svelte'
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

        // Build the update in the stimulus's CURRENT display order —
        // `updateAoisBatch` commits `aois.map(a => a.id)` as the new
        // orderVector, so iterating raw ids here would silently reset the
        // user's (or natural-sort) AOI order as a side effect of a
        // propagated rename/recolor.
        const order = meta.aois.orderVector?.[sId]
        const displayIds =
          order && order.length === stimAois.length
            ? order
            : stimAois.map((_, i) => i)

        let modified = false
        const nextAois = displayIds.map(aId => {
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
