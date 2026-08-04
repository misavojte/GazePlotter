import type { PlotScreenFactory } from '$lib/plots/definePlot'
import { plotCursorPort } from '$lib/plots/shared/plotCursor.svelte'
import type { EvolvingMetricsSettings } from '../types'

/**
 * Screen recipe: the shared PLOT CURSOR and nothing else. x is always absolute ms
 * here (both presentations), so the scope is simply the stimulus. The port is
 * built ONCE and handed through `props` unchanged, so a hovering sibling never
 * re-derives this plot. Export builds no recipe, hence no cursor at all.
 */
export const evolvingMetricsScreen: PlotScreenFactory<
  EvolvingMetricsSettings
> = ctx => {
  const plotCursor = plotCursorPort(ctx.item.id, () => ctx.item.settings.stimulusId)
  return { props: () => ({ plotCursor }) }
}
