import ScarfPlot from './components/ScarfPlot.svelte'
import ScarfExportFigure from './components/ScarfExportFigure.svelte'
import ScarfPlotPaneSettings from './components/ScarfPlotPaneSettings.svelte'
import { definePlot } from '$lib/plots/definePlot'
import type { PlotSubtitleParts } from '$lib/plots/definePlot'
import {
  getStimuliOptions,
  getParticipantsGroupOptions,
} from '$lib/plots/shared'
import type { ScarfPlotSettings } from './types'

export const scarfPlotDefinition = definePlot<'scarf', ScarfPlotSettings>({
  type: 'scarf',
  name: 'Scarf Plot',
  component: ScarfPlot,
  paneSettings: ScarfPlotPaneSettings,
  export: { figure: ScarfExportFigure },
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
    timeline: 'absolute',
    absoluteStimuliLimits: [],
    ordinalStimuliLimits: [],
    dynamicAOI: true,
    displayMode: undefined,
  }),
  getMinSize: () => ({ w: 14, h: 10 }),
  getDefaultHeight: () => 12,
  getDefaultWidth: () => 20,
  requireCapabilities: [['segmented', 'event']],
})
