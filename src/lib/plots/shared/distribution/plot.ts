import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { DataCapabilityRequirements, ParticipantScope } from '$lib/data/types'
import type { PlotMetricContract } from '$lib/metrics'
import { definePlot, type PlotDefinition } from '$lib/plots/definePlot'
import type { PlotGroup } from '$lib/plots/groups'
import { stimulusParticipantsSubtitle } from '$lib/plots/shared/subtitles'
import { collectDistribution } from './collect'
import { distributionDefaults, distributionVisualizationSection } from './paneSection'
import { distributionValueAxisScreen } from './screen.svelte'
import type { DistributionAxis, DistributionResult, StatisticalOverlayType } from './types'
// LAST, load-bearing: the figure pulls in the plot registry, which evaluates the
// other comparison definitions while this module is still importing, so
// everything `defineDistributionPlot` reads at call time must be bound above.
import { deriveDistributionFigure, type DistributionDisclosures, type DistributionView } from './figure'

/** The settings every comparison plot stores; `TOrder` is its category-order value. */
export type DistributionPlotSettings<TOrder extends string = string> = ParticipantScope & {
  stimulusId: number
  /** Metric-library reference; an array (0 or 1 long) so persistence matches multi-select plots. */
  metricInstanceIds: string[]
  orientation: 'vertical' | 'horizontal'
  orderBy: 'value' | TOrder
  orderDirection: 'asc' | 'desc'
  scaleRange: [number, number]
  timelineStart?: number
  timelineEnd?: number
  statisticalOverlay: StatisticalOverlayType
}

/** What the data side reads: everything but the figure's orientation. */
export type DistributionDataSettings<S> = Omit<S, 'orientation'>

/** What one comparison plot contributes; everything else is shared, so they cannot drift. */
export interface DistributionPlotSpec<TType extends string, S extends DistributionPlotSettings> {
  type: TType
  name: string
  tagline: string
  group: PlotGroup
  /** Admits the vector instances this plot draws whole, one distribution per slot. */
  contract: PlotMetricContract
  /** The category axis in drawn order, narrowed by the selection; built once a metric resolved. */
  axis: (engine: DataEngine, settings: DistributionDataSettings<S>) => DistributionAxis
  disclosures: DistributionDisclosures
  /** The plot's own order option, e.g. `{ label: 'AOI order', value: 'aoi' }`; also the default order. */
  categoryOrder: { label: string; value: Exclude<S['orderBy'], 'value'> }
  /** The shared pane section that narrows the axis. */
  selectionSection: 'aoi' | 'eyeMovement' | 'event'
  /** Settings beyond the shared defaults; at least the default metric. */
  defaults: Partial<S> & { metricInstanceIds: string[] }
  requireCapabilities: DataCapabilityRequirements
  /** Share the value axis with same-type, same-metric, same-size plots on screen. */
  syncValueAxis?: boolean
}

export type DistributionPlotDefinition<TType extends string, S> = PlotDefinition<TType, S, DistributionView> & {
  /** The distribution data without the figure. */
  collect: (engine: DataEngine, settings: DistributionDataSettings<S>) => DistributionResult
}

/** A comparison plot: one distribution per category slot of a vector metric. See the import order above. */
export function defineDistributionPlot<TType extends string, S extends DistributionPlotSettings>(
  spec: DistributionPlotSpec<TType, S>
): DistributionPlotDefinition<TType, S> {
  const collect = (engine: DataEngine, settings: DistributionDataSettings<S>) =>
    collectDistribution({
      engine,
      contract: spec.contract,
      settings,
      axis: () => spec.axis(engine, settings),
    })

  const definition = definePlot<TType, S, DistributionView>({
    type: spec.type,
    name: spec.name,
    tagline: spec.tagline,
    group: spec.group,
    paneSections: [
      'stimulus',
      'participants',
      'metric',
      distributionVisualizationSection({
        key: `${spec.type}:visualization`,
        categoryOrder: spec.categoryOrder,
      }),
      'timelineRange',
      spec.selectionSection,
    ],
    view: {
      deriveView: (engine, settings) =>
        deriveDistributionFigure(engine, collect(engine, settings), settings, spec.disclosures),
    },
    ...(spec.syncValueAxis ? { screen: distributionValueAxisScreen<S>() } : {}),
    getSubtitle: stimulusParticipantsSubtitle,
    getDefaultSettings: (params = {}) => {
      const settings: DistributionPlotSettings = {
        ...distributionDefaults(params),
        orderBy: spec.categoryOrder.value,
        ...spec.defaults,
      }
      return settings as S
    },
    requireCapabilities: spec.requireCapabilities,
    consumesMetrics: spec.contract,
  })

  return { ...definition, collect }
}
