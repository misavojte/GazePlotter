import AoiStreamPlot from './components/AoiStreamPlot.svelte'
import AoiStreamExportFigure from './components/AoiStreamExportFigure.svelte'
import AoiStreamPlotPaneSettings from './components/AoiStreamPlotPaneSettings.svelte'
import { definePlot } from '$lib/plots/definePlot'
import type { PlotSubtitleParts } from '$lib/plots/definePlot'
import {
  getStimuliOptions,
  getParticipantsGroupOptions,
} from '$lib/plots/shared'
import type { AoiStreamPlotSettings } from './types'

export const aoiStreamPlotDefinition = definePlot<
  'aoiStreamPlot',
  AoiStreamPlotSettings
>({
  type: 'aoiStreamPlot',
  name: 'Time-binned AOI Occupancy',
  component: AoiStreamPlot,
  paneSettings: AoiStreamPlotPaneSettings,
  export: { figure: AoiStreamExportFigure },
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
    binSize: 500,
    absoluteStimuliLimits: [],
  }),
  getMinSize: () => ({ w: 11, h: 10 }),
  getDefaultHeight: () => 12,
  getDefaultWidth: () => 12,
  requireCapabilities: ['segmented'],
})
