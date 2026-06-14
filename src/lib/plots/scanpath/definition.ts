import ScanpathPlot from './components/ScanpathPlot.svelte'
import { deriveScanpathView } from './core/view'
import {
  StimulusSection,
  ParticipantSection,
} from '$lib/plots/shared/components/sections'
import ScanpathDisplaySection from './components/sections/ScanpathDisplaySection.svelte'
import { definePlot } from '$lib/plots/definePlot'
import type { PlotSubtitleParts } from '$lib/plots/definePlot'
import {
  getStimuliOptions,
  getParticipantOptions,
} from '$lib/plots/shared'
import type { ScanpathPlotSettings } from './types'

export const scanpathPlotDefinition = definePlot<'scanpath', ScanpathPlotSettings>({
  type: 'scanpath',
  name: 'Scanpath Plot',
  component: ScanpathPlot,
  paneSections: [
    { key: 'stimulus', component: StimulusSection },
    { key: 'participant', component: ParticipantSection },
    { key: 'scanpath:display', component: ScanpathDisplaySection },
  ],
  export: { deriveView: deriveScanpathView },
  getSubtitle: ({ item, engine }) => {
    const parts: PlotSubtitleParts = []
    const stim = getStimuliOptions(engine).find(
      o => o.value === String(item.settings.stimulusId)
    )
    if (stim?.label) parts.push({ label: 'Stimulus', value: stim.label })
    const participant = getParticipantOptions(engine).find(
      o => o.value === String(item.settings.participantId)
    )
    if (participant?.label) {
      parts.push({ label: 'Participant', value: participant.label })
    }
    return parts.length === 0 ? undefined : parts
  },
  getDefaultSettings: (params = {}) => ({
    stimulusId: params.stimulusId ?? 0,
    participantId: 0,
    showFixationOrder: true,
    showNumbers: true,
  }),
  getMinSize: () => ({ w: 12, h: 10 }),
  getDefaultHeight: () => 12,
  getDefaultWidth: () => 16,
  requireCapabilities: [['segmented', 'spatial']],
})
