import type { MetricInstance } from '$lib/metrics'
import type { PlotView } from '$lib/plots/definePlot'
import {
  BeeswarmFigure,
  buildBeeswarmFigureProps,
  type BeeswarmFigureSettings,
} from './beeswarm'
import type { DistributionResult, DistributionViewMeta } from './types'

/**
 * The per-plot vocabulary the shared figure cannot know: what a category slot
 * IS (the tooltip's first-row key), how to make the figure fit, and how a
 * screen reader names it. Required, not optional — the figure serves several
 * plots, so it must never speak one consumer's language by default.
 */
export interface DistributionDisclosures {
  itemTooltipKey: string
  cannotFitHints: string[]
  ariaLabel: string
}

/**
 * WHICH FIGURE draws the distribution, and the view-model to draw it with —
 * the single seam between the entity-agnostic measure layer and the marks. Both
 * comparison plots derive through here, so the axis label, the proportion rule,
 * the figure geometry and the sync meta cannot drift between them; only the
 * disclosure strings differ.
 *
 * One mark today (`./beeswarm`). When a second rendering lands — histogram rows
 * with a shared count scale — the plot's `visualisation` setting is read HERE
 * and nowhere else: this stays the only file that names a figure component.
 */
export function deriveDistributionFigure(
  result: DistributionResult,
  instance: MetricInstance | null | undefined,
  settings: BeeswarmFigureSettings,
  disclosures: DistributionDisclosures
): PlotView {
  return {
    component: BeeswarmFigure,
    props: buildBeeswarmFigureProps(
      result,
      instance,
      settings,
      disclosures
    ) as unknown as Record<string, unknown>,
    meta: {
      syncKey: instance?.id ?? null,
      dataMax: result.dataMax,
    } satisfies DistributionViewMeta,
  }
}
