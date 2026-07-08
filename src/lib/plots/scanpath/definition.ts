import { deriveScanpathView } from './core/view'
import {
  StimulusSection,
  ParticipantSection,
} from '$lib/plots/shared/components/sections'
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
    {
      key: 'scanpath:display',
      title: 'Display',
      fields: [
        { kind: 'boolean', key: 'showFixationOrder', label: 'Show fixation order line' },
        { kind: 'boolean', key: 'showNumbers', label: 'Show fixation numbers' },
      ],
      summary: ctx => {
        const order = ctx.common(s => s.showFixationOrder)
        const numbers = ctx.common(s => s.showNumbers)
        if (order.mixed || numbers.mixed) return 'Mixed'
        const parts: string[] = []
        if (order.value) parts.push('Order line')
        if (numbers.value) parts.push('Numbers')
        return parts.length === 0 ? 'None' : parts.join(', ')
      },
    },
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
