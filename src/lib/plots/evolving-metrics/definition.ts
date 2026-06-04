import EvolvingMetricsPlot from './components/EvolvingMetricsPlot.svelte'
import { deriveEvolvingMetricsView } from './core/view'
import EvolvingMetricsPlotPaneSettings from './components/EvolvingMetricsPlotPaneSettings.svelte'
import { definePlot } from '$lib/plots/definePlot'
import type { PlotSubtitleParts } from '$lib/plots/definePlot'
import {
  getStimuliOptions,
  getParticipantsGroupOptions,
} from '$lib/plots/shared'
import type { EvolvingMetricsSettings } from './types'

export const evolvingMetricsDefinition = definePlot<
  'evolvingMetrics',
  EvolvingMetricsSettings
>({
  type: 'evolvingMetrics',
  name: 'Evolving Metrics',
  component: EvolvingMetricsPlot,
  paneSettings: EvolvingMetricsPlotPaneSettings,
  export: { deriveView: deriveEvolvingMetricsView },
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
    metricInstanceIds: ['avgFixationDuration-any-windowed'],
    timelineStart: 0,
    timelineEnd: 0,
  }),
  getMinSize: () => ({ w: 11, h: 10 }),
  getDefaultHeight: () => 12,
  getDefaultWidth: () => 12,
  requireCapabilities: ['segmented'],
  consumesMetrics: {
    outputShape: 'scalar',
    windowing: 'required',
  },
})
