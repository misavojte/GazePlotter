import type { ComponentProps } from 'svelte'
import type { CanvasExportProps } from '$lib/plots/shared'
import type { MetricInstance } from '$lib/metrics'
import BeeswarmFigure from './BeeswarmFigure.svelte'
import { getDistributionAxisLabel } from '../labels'
import type { DistributionResult, StatisticalOverlayType } from '../types'

/** The figure's data/config props (everything bar the canvas-sizing props). */
export type BeeswarmFigureProps = Omit<
  ComponentProps<typeof BeeswarmFigure>,
  keyof CanvasExportProps
>

/**
 * The settings this figure reads, declared HERE rather than Picked from one
 * plot's settings type — the shared layer must not depend on either consumer.
 * Both plots' settings satisfy this structurally.
 */
export interface BeeswarmFigureSettings {
  timelineStart?: number
  timelineEnd?: number
  statisticalOverlay: StatisticalOverlayType
  orientation: 'vertical' | 'horizontal'
}

/**
 * THE props every `BeeswarmFigure` plot renders with — the AOI Comparison and
 * the Eye-movement Comparison. Owns the figure's fixed geometry and,
 * load-bearing, the rule that a PROPORTION metric suppresses the overlay in
 * the axis label: those render as plain proportional bars, so the label must
 * not claim a mean ± CI / SD / boxplot statistic that isn't drawn. `extras`
 * carries the per-plot disclosure strings (tooltip noun, cannot-fit hints,
 * aria label) and is spread last.
 */
export function buildBeeswarmFigureProps(
  result: DistributionResult,
  resolvedInstance: MetricInstance | null | undefined,
  settings: BeeswarmFigureSettings,
  extras?: Partial<BeeswarmFigureProps>
): BeeswarmFigureProps {
  return {
    data: result.data,
    timeline: result.timeline,
    axisLabel: getDistributionAxisLabel(
      resolvedInstance,
      settings.timelineStart,
      settings.timelineEnd,
      result.proportion ? 'none' : settings.statisticalOverlay
    ),
    orientation: settings.orientation,
    onDataHover: () => {},
    statisticalOverlay: settings.statisticalOverlay,
    noMetric: result.noMetric ?? false,
    proportion: result.proportion ?? false,
    ...extras,
  }
}
