import { deriveScanpathView } from './core/view'
import { plotCursorScreen } from '$lib/plots/shared/plotCursor.svelte'
import { definePlot } from '$lib/plots/definePlot'
import { stimulusParticipantSubtitle } from '$lib/plots/shared'
import type { ScanpathPlotSettings } from './types'

export const scanpathPlotDefinition = definePlot<'scanpath', ScanpathPlotSettings>({
  type: 'scanpath',
  name: 'Scanpath',
  group: 'gaze-behavior',
  paneSections: [
    'stimulus',
    'participant',
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
  screen: plotCursorScreen(),
  getSubtitle: stimulusParticipantSubtitle,
  getDefaultSettings: (params = {}) => ({
    stimulusId: params.stimulusId ?? 0,
    participantId: 0,
    showFixationOrder: true,
    showNumbers: true,
  }),
  size: { min: { w: 12, h: 10 }, w: 16 },
  requireCapabilities: [['segmented', 'spatial']],
})
