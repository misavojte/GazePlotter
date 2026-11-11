import { deriveTransitionMatrixView, type TransitionMatrixView } from './core/view'
import { definePlot } from '$lib/plots/definePlot'
import { PRESET_PALETTES } from '$lib/color/palettes'
import { stimulusParticipantsSubtitle } from '$lib/plots/shared'
import { OUT_OF_BOUNDS_DEFAULTS, outOfBoundsFields } from '$lib/plots/shared/outOfBounds'
import type { TransitionMatrixPlotSettings } from './types'
import { getAois } from '$lib/data/engine'
// Called at definition time: import the modules, not the barrel.
import { reconcileStimulusScopedHighlights } from '$lib/plots/shared/highlightReconcile'
import { prefixedHighlights } from '$lib/plots/shared/highlightLink'

export const transitionMatrixDefinition = definePlot<
  'transitionMatrix',
  TransitionMatrixPlotSettings,
  TransitionMatrixView
>({
  type: 'transitionMatrix',
  name: 'Transition Matrix',
  tagline: 'Gaze transitions between AOIs',
  group: 'sequence',
  keywords: 'transitions Markov AOI pairs',
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
  view: {
    deriveView: deriveTransitionMatrixView,
    viewOnly: { settings: ['highlights'], input: s => ({ highlights: s.highlights ?? [] }) },
  },
  // Highlights are bare AOI ids, as in the AOI Timeline; No AOI is -1.
  highlights: prefixedHighlights({ aoi: '', noAoi: '-1' }),
  onCommand: reconcileStimulusScopedHighlights<TransitionMatrixPlotSettings>(
    () => true,
    (engine, s) => [...getAois(engine, s.stimulusId).map(a => String(a.id)), '-1']
  ),
  // Matrices sharing metric, color scale and grid size share the largest data
  // max while their color range is default.
  sync: [
    {
      channel: 'transition-matrix-color',
      offer: ({ view, item }) => {
        const meta = view?.meta
        if (!meta?.isDefaultColorRange) return null
        return { key: [meta.syncGroupKey, meta.colorScaleKey, item.w, item.h], own: meta.ownDataMax }
      },
      input: (_view, max) => ({ colorValueRange: [0, max] as [number, number] }),
    },
  ],
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
