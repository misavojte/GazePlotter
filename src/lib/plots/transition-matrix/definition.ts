import { deriveTransitionMatrixView } from './core/view'
import { transitionMatrixScreen } from './core/screen.svelte'
import { definePlot } from '$lib/plots/definePlot'
import { PRESET_PALETTES } from '$lib/color/palettes'
import { stimulusParticipantsSubtitle } from '$lib/plots/shared'
import { OUT_OF_BOUNDS_DEFAULTS, outOfBoundsFields } from '$lib/plots/shared/outOfBounds'
import type { TransitionMatrixPlotSettings } from './types'

export const transitionMatrixDefinition = definePlot<
  'transitionMatrix',
  TransitionMatrixPlotSettings
>({
  type: 'transitionMatrix',
  name: 'Transition Matrix',
  tagline: 'Gaze transitions between AOIs',
  group: 'inter-aoi',
  paneSections: [
    'stimulus',
    'participants',
    'metric',
    {
      key: 'transitionMatrix:visualization',
      title: 'Visualization',
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
        ...outOfBoundsFields(),
      ],
      summary: () => 'Matrix',
    },
    'timelineRange',
    'aoi',
  ],
  view: { deriveView: deriveTransitionMatrixView },
  screen: transitionMatrixScreen,
  getSubtitle: stimulusParticipantsSubtitle,
  getDefaultSettings: (params = {}) => ({
    stimulusId: params.stimulusId ?? 0,
    hideEmptyParticipants: false,
    stimuliColorValueRanges: [],
    metricInstanceIds: ['transitionCount-fix'],
    ...OUT_OF_BOUNDS_DEFAULTS,
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
