import { deriveScanpathView } from './core/view'
import {
  StimulusSection,
  ParticipantSection,
} from '$lib/plots/shared/components/sections'
import ScanpathDisplaySection from './components/sections/ScanpathDisplaySection.svelte'
import { definePlot } from '$lib/plots/definePlot'
import { stimulusParticipantSubtitle } from '$lib/plots/shared'
import type { ScanpathPlotSettings } from './types'

export const scanpathPlotDefinition = definePlot<'scanpath', ScanpathPlotSettings>({
  type: 'scanpath',
  name: 'Scanpath',
  group: 'gaze-behavior',
  paneSections: [
    { key: 'stimulus', component: StimulusSection },
    { key: 'participant', component: ParticipantSection },
    { key: 'scanpath:display', component: ScanpathDisplaySection },
  ],
  view: { deriveView: deriveScanpathView },
  getSubtitle: stimulusParticipantSubtitle,
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
