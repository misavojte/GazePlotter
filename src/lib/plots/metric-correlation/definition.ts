import MetricCorrelationPlot from './components/MetricCorrelationPlot.svelte'
import MetricCorrelationExportFigure from './components/MetricCorrelationExportFigure.svelte'
import MetricCorrelationPaneSettings from './components/MetricCorrelationPaneSettings.svelte'
import { definePlot } from '$lib/plots/definePlot'
import type { PlotSubtitleParts } from '$lib/plots/definePlot'
import {
  getStimuliOptions,
  getParticipantsGroupOptions,
} from '$lib/plots/shared'
import type { MetricCorrelationSettings } from './types'

export const metricCorrelationDefinition = definePlot<
  'metricCorrelation',
  MetricCorrelationSettings
>({
  type: 'metricCorrelation',
  name: 'Metric Correlation',
  component: MetricCorrelationPlot,
  paneSettings: MetricCorrelationPaneSettings,
  export: { figure: MetricCorrelationExportFigure },
  getSubtitle: ({ item, engine }) => {
    const parts: PlotSubtitleParts = []
    const stim = getStimuliOptions(engine).find(
      o => o.value === String(item.settings.stimulusId)
    )
    if (stim?.label) parts.push({ label: 'Stimulus', value: stim.label })
    const group = getParticipantsGroupOptions(
      engine,
      true,
      item.settings.stimulusId
    ).find(o => o.value === String(item.settings.groupId))
    if (group?.label) parts.push({ label: 'Group', value: group.label })
    return parts.length === 0 ? undefined : parts
  },
  getDefaultSettings: (params = {}) => ({
    stimulusId: params.stimulusId ?? 0,
    groupId: params.groupId ?? -1,
    view: 'heatmap',
    correlationMethod: 'spearman',
    enabledMetricIds: [],
  }),
  getMinSize: () => ({ w: 11, h: 11 }),
  getDefaultHeight: () => 13,
  getDefaultWidth: () => 13,
  requireCapabilities: ['segmented'],
  consumesMetrics: {
    leaves: ['identity-scalar', 'pick-aoi', 'aggregate-aoi', 'matrix-cell', 'matrix-aggregate'],
    windowing: 'forbidden',
    multiSelect: true,
  },
})
