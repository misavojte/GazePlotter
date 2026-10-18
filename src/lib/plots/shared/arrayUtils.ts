import type { PlotScreenContext } from '$lib/plots/definePlot'
import { createCommandSourcePlotPattern } from '$lib/workspace/commands/utils'

/**
 * Returns a new array with `item` toggled: removed if present, appended if absent.
 */
export function toggleInArray<T>(array: T[], item: T): T[] {
  return array.includes(item)
    ? array.filter(v => v !== item)
    : [...array, item]
}

/** Toggles `value` in the item's array setting `key`, as one plot-sourced command. */
export function toggleSettingEntry<S, K extends keyof S & string>(
  ctx: PlotScreenContext<S>,
  key: K,
  value: NonNullable<S[K]> extends (infer T)[] ? T : never
): void {
  const current = (ctx.item.settings[key] ?? []) as (typeof value)[]
  ctx.workspace.updateItemSettings(
    ctx.item.id,
    { [key]: toggleInArray(current, value) },
    createCommandSourcePlotPattern(ctx.item, 'plot')
  )
}
