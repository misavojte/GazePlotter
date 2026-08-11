import type {
  SchemaPaneSectionEntry,
  SectionFieldCtx,
  SectionFieldOption,
} from '$lib/plots/definePlot'
import { pickedInstanceIsProportion as isProportion } from '$lib/plots/shared/metricResolver'
import {
  DIRECTION_OPTIONS,
  ORIENTATION_OPTIONS,
  OVERLAY_OPTIONS,
  overlaySummaryLabel,
} from './labels'

/**
 * THE "Visualisation" pane section for every plot that draws a distribution —
 * one declaration, so the controls, their order, and the collapsed-header
 * summary cannot drift between the AOI Comparison and the Eye-movement
 * Comparison. The plot supplies only its section key and the name of its own
 * category order ('AOI order', 'Type order').
 *
 * The overlay field hides for a PROPORTION metric: those render as plain bars,
 * so an overlay choice would promise a statistic the figure doesn't draw. The
 * rule reads off the metric's declared class (never a list of recipe ids), and
 * the summary follows it — `Horizontal (Bars)` instead of an overlay label.
 */
export function distributionVisualisationSection(args: {
  /** Namespaced section key — `'<plotType>:visualisation'`. */
  key: string
  /** This plot's category-order option, e.g. `{ label: 'AOI order', value: 'aoi' }`. */
  categoryOrder: SectionFieldOption
}): SchemaPaneSectionEntry {
  return {
    key: args.key,
    title: 'Visualisation',
    fields: [
      {
        kind: 'enum',
        key: 'statisticalOverlay',
        label: 'Statistical overlay',
        options: OVERLAY_OPTIONS,
        showWhen: ctx => !isProportion(ctx),
      },
      {
        kind: 'enum',
        key: 'orientation',
        label: 'Orientation',
        options: ORIENTATION_OPTIONS,
      },
      {
        kind: 'enum',
        key: 'orderBy',
        label: 'Order by',
        options: [{ label: 'Value', value: 'value' }, args.categoryOrder],
      },
      {
        kind: 'enum',
        key: 'orderDirection',
        label: 'Direction',
        options: DIRECTION_OPTIONS,
      },
      { kind: 'scaleRange', key: 'scaleRange', legend: 'Scale range' },
    ],
    summary: distributionVisualisationSummary,
  }
}

function distributionVisualisationSummary(ctx: SectionFieldCtx): string {
  const orientation = ctx.common(s => s.orientation)
  const overlay = ctx.common(s => s.statisticalOverlay)
  const o = orientation.mixed
    ? 'Mixed'
    : orientation.value === 'horizontal'
      ? 'Horizontal'
      : 'Vertical'
  if (isProportion(ctx)) return `${o} (Bars)`
  if (orientation.mixed || overlay.mixed) return 'Mixed'
  return `${o} (${overlaySummaryLabel(String(overlay.value))})`
}
