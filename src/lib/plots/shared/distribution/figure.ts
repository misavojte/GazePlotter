import { figureView, type PlotView } from '$lib/plots/definePlot'
import { resolvePickedInstance, type MetricResolutionEngine } from '$lib/plots/shared/metricResolver'
import {
  BeeswarmFigure,
  buildBeeswarmFigureProps,
  type BeeswarmFigureProps,
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

export type DistributionView = PlotView<BeeswarmFigureProps, DistributionViewMeta>

/**
 * WHICH FIGURE draws the distribution, and the view-model to draw it with —
 * the single seam between the entity-agnostic measure layer and the marks. Both
 * comparison plots derive through here, so the axis label, the proportion rule,
 * the figure geometry and the sync meta cannot drift between them; only the
 * disclosure strings differ.
 *
 * One mark today (`./beeswarm`). When a second rendering lands — histogram rows
 * with a shared count scale — the plot's `visualization` setting is read HERE
 * and nowhere else: this stays the only file that names a figure component.
 */
export function deriveDistributionFigure(
  engine: MetricResolutionEngine,
  result: DistributionResult,
  settings: BeeswarmFigureSettings & { metricInstanceIds: readonly string[] },
  disclosures: DistributionDisclosures
): DistributionView {
  const instance = resolvePickedInstance(engine, settings.metricInstanceIds)
  return figureView(
    BeeswarmFigure,
    buildBeeswarmFigureProps(result, instance, settings, disclosures),
    { meta: { syncKey: instance?.id ?? null, dataMax: result.dataMax } }
  )
}
