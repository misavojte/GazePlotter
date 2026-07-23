import { deriveTransitionMatrixView } from './core/view'
import { transitionMatrixScreen } from './core/screen.svelte'
import { definePlot } from '$lib/plots/definePlot'
import { INACTIVE_COLOR, PRESET_PALETTES } from '$lib/color/palettes'
import { stimulusGroupSubtitle } from '$lib/plots/shared'
import type { TransitionMatrixPlotSettings } from './types'

export const transitionMatrixDefinition = definePlot<
  'transitionMatrix',
  TransitionMatrixPlotSettings
>({
  type: 'transitionMatrix',
  name: 'Transition Matrix',
  group: 'inter-aoi',
  paneSections: [
    'stimulus',
    'group',
    'metric',
    {
      key: 'transitionMatrix:visualisation',
      title: 'Visualisation',
      fields: [
        {
          kind: 'stimulusColorRange',
          key: 'stimuliColorValueRanges',
          group: 'Color scale',
        },
        {
          kind: 'colorScale',
          key: 'colorScale',
          group: 'Color scale',
          defaultMin: '#f7fbff',
          defaultMax: '#08306b',
        },
        {
          kind: 'color',
          key: 'belowMinColor',
          label: 'Below min',
          group: 'Out of bounds',
          pair: true,
        },
        {
          kind: 'boolean',
          key: 'showBelowMinLabels',
          label: 'Show text',
          group: 'Out of bounds',
          pair: true,
        },
        {
          kind: 'color',
          key: 'aboveMaxColor',
          label: 'Above max',
          group: 'Out of bounds',
          pair: true,
        },
        {
          kind: 'boolean',
          key: 'showAboveMaxLabels',
          label: 'Show text',
          group: 'Out of bounds',
          pair: true,
        },
      ],
      summary: () => 'Matrix',
    },
    'timelineRange',
    'aoi',
  ],
  view: { deriveView: deriveTransitionMatrixView },
  screen: transitionMatrixScreen,
  getSubtitle: stimulusGroupSubtitle,
  getDefaultSettings: (params = {}) => ({
    stimulusId: params.stimulusId ?? 0,
    groupId: params.groupId ?? -1,
    stimuliColorValueRanges: [],
    metricInstanceIds: ['transitionCount-fix'],
    belowMinColor: INACTIVE_COLOR,
    aboveMaxColor: INACTIVE_COLOR,
    showBelowMinLabels: false,
    showAboveMaxLabels: false,
    colorScale: [...PRESET_PALETTES.BLUE.colors],
    hideNoAoi: false,
  }),
  requireCapabilities: ['segmented'],
  consumesMetrics: {
    outputShape: 'aoi-pair-matrix',
    windowing: 'forbidden',
    crossParticipant: 'reduce',
  },
})
