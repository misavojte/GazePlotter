import { onDestroy } from 'svelte'
import type { PlotScreenFactory } from '$lib/plots/definePlot'
import { timeCursorPort } from '$lib/plots/shared/timeCursor.svelte'
import type { EvolvingMetricsSettings } from '../types'

/**
 * Screen recipe: the shared TIME CURSOR and nothing else. x is always absolute ms
 * here (both presentations), so the scope is simply the stimulus. The port is
 * built ONCE and handed through `props` unchanged, so a hovering sibling never
 * re-derives this plot. Export builds no recipe, hence no cursor at all.
 */
export const evolvingMetricsScreen: PlotScreenFactory<
  EvolvingMetricsSettings
> = ctx => {
  const timeCursor = timeCursorPort(ctx.item.id, () => ctx.item.settings.stimulusId)
  onDestroy(() => timeCursor.publish(null))
  return { props: () => ({ timeCursor }) }
}
