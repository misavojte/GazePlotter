import { getVizConfig } from '$lib/plots/registry'
import { DEFAULT_PLOT_SIZE } from '$lib/plots/definePlot'
import { generateUniqueId } from '$lib/shared/utils/idUtils'
import type {
  AllGridTypes,
  GridItemMap,
  GridItemSnapshot,
} from '$lib/workspace'

export function createGridItem<K extends keyof GridItemMap>(
  type: K,
  options: GridItemSnapshot<K> = { type }
): AllGridTypes {
  const viz = getVizConfig(type)
  const id = options.id ?? generateUniqueId()
  const defaultSettings = viz.getDefaultSettings(options.settings)

  const base = {
    id,
    x: options.x ?? 0,
    y: options.y ?? 0,
    w: options.w ?? viz.size?.w ?? DEFAULT_PLOT_SIZE.w,
    h: options.h ?? viz.size?.h ?? DEFAULT_PLOT_SIZE.h,
    min: options.min ?? viz.size?.min ?? DEFAULT_PLOT_SIZE.min,
    redrawTimestamp: Date.now(),
  }

  return {
    ...base,
    type,
    settings: {
      ...defaultSettings,
      ...(options.settings ?? {}),
    },
  } as unknown as AllGridTypes
}

export function duplicateGridItem(
  item: AllGridTypes,
  duplicateId?: number
): AllGridTypes {
  return {
    ...item,
    id: duplicateId ?? generateUniqueId(),
    settings: { ...item.settings },
  } as AllGridTypes
}
