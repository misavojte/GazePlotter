import { deriveScarfView } from './core/view'
import { scarfScreen } from './core/screen.svelte'
import { definePlot } from '$lib/plots/definePlot'
import { stimulusGroupSubtitle } from '$lib/plots/shared'
import type { ScarfPlotSettings } from './types'
import { SCARF_IDENTIFIERS, isAoiLayerHighlight } from './const'
import { getAois } from '$lib/data/engine'
import type { WorkspaceCommand } from '$lib/workspace/commands'

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
        // 'eyeMovement' sections each offer the built-in "None" (events off /
        // no eye-movement types at all, fixations included) — no hide
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
  onCommand: (command, item, engine, dispatch): void => {
    const settings = item.settings as ScarfPlotSettings
    const highlights = settings.highlights ?? []
    if (highlights.length === 0) return

    // Case 1: stimulus switch on this item — clear all AOI highlights
    if (
      command.type === 'updateSettings' &&
      command.updates.some(
        u => u.itemId === item.id && 'stimulusId' in u.settings
      )
    ) {
      const kept = highlights.filter(h => !isAoiLayerHighlight(h))
      if (kept.length < highlights.length) {
        dispatch({
          type: 'updateSettings',
          updates: [{ itemId: item.id, settings: { highlights: kept } }],
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
      const kept = highlights.filter(
        h => !isAoiLayerHighlight(h) || validAoiIds.has(h)
      )
      if (kept.length < highlights.length) {
        dispatch({
          type: 'updateSettings',
          updates: [{ itemId: item.id, settings: { highlights: kept } }],
          source: 'plot.onCommand',
        })
      }
      return
    }
  },
})
