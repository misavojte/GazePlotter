import { deriveScarfView } from './core/view'
import { scarfScreen } from './core/screen.svelte'
import { definePlot } from '$lib/plots/definePlot'
import { stimulusGroupSubtitle } from '$lib/plots/shared'
// Called at definition time: import the module, not the barrel, which the
// registry -> shared sections -> registry cycle leaves half-initialised.
import { reconcileStimulusScopedHighlights } from '$lib/plots/shared/highlightReconcile'
import type { ScarfPlotSettings } from './types'
import { SCARF_IDENTIFIERS, isStimulusScopedHighlight } from './const'
import { getAois, getEventChannels } from '$lib/data/engine'

export const scarfPlotDefinition = definePlot<'scarf', ScarfPlotSettings>({
  type: 'scarf',
  name: 'Scarf Plot',
  group: 'gaze-behavior',
  paneSections: [
    'stimulus',
    'group',
    {
      key: 'scarf:visualisation',
      title: 'Visualisation',
      fields: [
        {
          kind: 'enum',
          key: 'timeline',
          group: 'Timeline mode',
          options: [
            { label: 'Absolute', value: 'absolute' },
            { label: 'Relative', value: 'relative' },
            { label: 'Ordinal', value: 'ordinal' },
          ],
          summary: true,
        },
        // Layer visibility is a per-plot SELECTION: the 'event' and
        // 'eyeMovement' sections each offer a seeded layer-off row ("No events"
        // = overlay off, "Just fixations" = the AOI layer alone) — no hide
        // toggles here.
      ],
    },
    {
      key: 'timelineRange',
      props: {
        // Scarf's range is dual-mode: the ordinal timeline edits ordinal
        // indices instead of ms.
        ordinalMode: {
          when: (s: ScarfPlotSettings) => s.timeline === 'ordinal',
          startKey: 'ordinalStart',
          endKey: 'ordinalEnd',
        },
      },
    },
    'aoi',
    'eyeMovement',
    'event',
  ],
  view: {
    deriveView: deriveScarfView,
    viewOnlySettings: ['highlights'],
  },
  screen: scarfScreen,
  getSubtitle: stimulusGroupSubtitle,
  getDefaultSettings: (params = {}) => ({
    stimulusId: params.stimulusId ?? 0,
    groupId: params.groupId ?? -1,
    timeline: 'absolute',
    absoluteStimuliLimits: [],
    ordinalStimuliLimits: [],
    hideNoAoi: false,
  }),
  size: { min: { w: 14, h: 10 }, w: 20 },
  requireCapabilities: [['segmented']],
  // Legend identifiers are prefix + id (see SCARF_IDENTIFIERS); the AOI and
  // event ids are per stimulus, categories are global.
  onCommand: reconcileStimulusScopedHighlights<ScarfPlotSettings>(
    isStimulusScopedHighlight,
    (engine, s) => [
      ...getAois(engine, s.stimulusId).map(a => `${SCARF_IDENTIFIERS.AOI}${a.id}`),
      `${SCARF_IDENTIFIERS.AOI}${SCARF_IDENTIFIERS.NOT_DEFINED}`,
      ...getEventChannels(engine, s.stimulusId).map(
        ch => `${SCARF_IDENTIFIERS.EVENT}${ch.id}`
      ),
    ]
  ),
})
