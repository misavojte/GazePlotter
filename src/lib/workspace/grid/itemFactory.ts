import { getVizConfig } from '$lib/plots/registry'
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

  // viz resolves to the union of every registered plot definition, so a
  // direct call to its layout helpers type-checks against the intersection
  // of all plots' parameter types. Any two plots declaring the same setting
  // key with incompatible literal types then collapses that key to never.
  // The spread is safe at runtime (each plot's default* helpers only read
  // keys they own), so we cast past the generic union here.
  const layoutInput = { ...defaultSettings, ...options } as never

  const base = {
    id,
    x: options.x ?? 0,
    y: options.y ?? 0,
    w: options.w ?? viz.getDefaultWidth(layoutInput),
    h: options.h ?? viz.getDefaultHeight(layoutInput),
    min: options.min ?? viz.getMinSize(options.settings),
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
