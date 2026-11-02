import { plotView, type PlotView } from '$lib/plots/definePlot'
import { resolvePickedInstance, type MetricResolutionEngine } from '$lib/plots/shared/metricResolver'
import { beeswarmKit, type BeeswarmInput } from './beeswarm/kit'
import { buildBeeswarmInput, type BeeswarmViewSettings } from './beeswarm/input'
import type { PlotPlaceholderContent } from '$lib/plots/shared/drawCanvasPlaceholder'
import type { DistributionResult, DistributionViewMeta } from './types'

/**
 * The per-plot vocabulary the shared figure cannot know: what a category slot
 * IS (the tooltip's first-row key), how to make the figure fit, what to say
 * when the axis is empty, and how a screen reader names it.
 */
export interface DistributionDisclosures {
  itemTooltipKey: string
  cannotFitHints: string[]
  /** The card shown when the category axis has no slots on this stimulus. */
  emptyPlaceholder: PlotPlaceholderContent
  ariaLabel: string
}

export type DistributionView = PlotView<BeeswarmInput, DistributionViewMeta>

/**
 * WHICH FIGURE draws the distribution, and the view-model to draw it with: the
 * single seam between the entity-agnostic measure layer and the marks, so the
 * comparison plots cannot drift on the axis label, the proportion rule, the
 * geometry or the sync meta. One mark today (`./beeswarm`); a second one reads
 * the plot's `visualization` setting HERE, the only file that names a figure kit.
 */
export function deriveDistributionFigure(
  engine: MetricResolutionEngine,
  result: DistributionResult,
  settings: BeeswarmViewSettings & { metricInstanceIds: readonly string[] },
  disclosures: DistributionDisclosures
): DistributionView {
  const instance = resolvePickedInstance(engine, settings.metricInstanceIds)
  return plotView(
    beeswarmKit,
    buildBeeswarmInput(result, instance, settings, disclosures),
    { meta: { syncKey: instance?.id ?? null, dataMax: result.dataMax } }
  )
}
