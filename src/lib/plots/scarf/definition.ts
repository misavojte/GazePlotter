import ScarfPlot from './components/ScarfPlot.svelte'
import { deriveScarfView } from './core/view'
import ScarfPlotPaneSettings from './components/ScarfPlotPaneSettings.svelte'
import { definePlot } from '$lib/plots/definePlot'
import type { PlotSubtitleParts } from '$lib/plots/definePlot'
import {
  getStimuliOptions,
  getParticipantsGroupOptions,
} from '$lib/plots/shared'
import type { ScarfPlotSettings } from './types'
import { SCARF_IDENTIFIERS } from './const'
import { getAois } from '$lib/data/engine'
import type { WorkspaceCommand } from '$lib/workspace/commands'

export const scarfPlotDefinition = definePlot<'scarf', ScarfPlotSettings>({
  type: 'scarf',
  name: 'Scarf Plot',
  component: ScarfPlot,
  paneSettings: ScarfPlotPaneSettings,
  export: { deriveView: deriveScarfView },
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
  onCommand: (command, item, engine, dispatch): void => {
    const settings = item.settings as ScarfPlotSettings
    const highlights = settings.highlights ?? []
    if (highlights.length === 0) return

    // Case 1: stimulus switch on this item — clear all AOI highlights
    if (
      command.type === 'updateSettings' &&
      command.itemId === item.id &&
      'stimulusId' in command.settings
    ) {
      const kept = highlights.filter(h =>
        h.startsWith(SCARF_IDENTIFIERS.CATEGORY) ||
        h.startsWith(SCARF_IDENTIFIERS.EVENT)
      )
      if (kept.length < highlights.length) {
        dispatch({
          type: 'updateSettings',
          itemId: item.id,
          settings: { highlights: kept },
          source: 'plot.onCommand',
        })
      }
      return
    }

    // Case 2: AOI grouping changed (could be propagated to this stimulus)
    if (command.type === 'updateAois') {
      const stimulusId = settings.stimulusId
      const currentAois = getAois(engine, stimulusId)
      const validAoiIds = new Set(
        currentAois.map(a => `${SCARF_IDENTIFIERS.AOI}${a.id}`)
      )
      const kept = highlights.filter(h =>
        !h.startsWith(SCARF_IDENTIFIERS.AOI) ||
        h.startsWith(SCARF_IDENTIFIERS.CATEGORY) ||
        validAoiIds.has(h)
      )
      if (kept.length < highlights.length) {
        dispatch({
          type: 'updateSettings',
          itemId: item.id,
          settings: { highlights: kept },
          source: 'plot.onCommand',
        })
      }
      return
    }
  },
})
