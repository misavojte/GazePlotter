import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { PlotView } from '$lib/plots/definePlot'
import { resolvePickedInstance } from '$lib/plots/shared'
import {
  BeeswarmFigure,
  buildBeeswarmFigureProps,
  type BeeswarmFigureProps,
} from '$lib/plots/shared/distribution/beeswarm'
import { getAoiComparisonData } from './transformer'
import type { AoiComparisonSettings } from '../types'

/**
 * This plot's entity vocabulary on the shared figure: what a category slot IS,
 * how to make the figure fit, and how a screen reader names it. Passed
 * explicitly rather than defaulted inside the figure — the figure serves both
 * comparisons, so it must not speak AOI by default.
 */
const AOI_DISCLOSURES: Partial<BeeswarmFigureProps> = {
  itemTooltipKey: 'AOI',
  cannotFitHints: ['Merge some AOIs in Plot Settings > Areas of Interest'],
  ariaLabel: 'AOI metrics visualization',
}

export interface AoiComparisonView {
  props: BeeswarmFigureProps
  /** Unsynced data maximum — the on-screen container uses it for value-axis sync. */
  dataMax: number
  /** Metric instance id used as the sync key, or null when sync is off. */
  syncKey: string | null
}

/**
 * Single source of truth for "what the AOI Comparison draws" from (engine,
 * settings). `props.timeline` is the UNSYNCED timeline; the on-screen container
 * may swap in a synced one (export never syncs). Both the screen container and
 * the export modal render from this.
 */
export function getAoiComparisonView(
  engine: DataEngine,
  settings: AoiComparisonSettings
): AoiComparisonView {
  const result = getAoiComparisonData(engine, settings)
  const resolvedInstance = resolvePickedInstance(engine, settings.metricInstanceIds)
  return {
    props: buildBeeswarmFigureProps(
      result,
      resolvedInstance,
      settings,
      AOI_DISCLOSURES
    ),
    dataMax: result.dataMax,
    syncKey: resolvedInstance?.id ?? null,
  }
}

/** Screen-coordination surface carried on the view for the screen recipe. */
export interface AoiComparisonViewMeta {
  syncKey: string | null
  dataMax: number
}

/** The `definePlot` view entry — the single derivation for screen and export. */
export function deriveAoiComparisonView(
  engine: DataEngine,
  settings: AoiComparisonSettings
): PlotView {
  const view = getAoiComparisonView(engine, settings)
  return {
    component: BeeswarmFigure,
    props: view.props as Record<string, unknown>,
    meta: {
      syncKey: view.syncKey,
      dataMax: view.dataMax,
    } satisfies AoiComparisonViewMeta,
  }
}
