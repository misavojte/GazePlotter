import { deriveScarfView } from './core/view'
import { scarfScreen } from './core/screen.svelte'
import { definePlot, type SectionFieldCtx } from '$lib/plots/definePlot'
import { stimulusGroupSubtitle } from '$lib/plots/shared'
import type { ScarfPlotSettings } from './types'
import { SCARF_IDENTIFIERS } from './const'
import { getAois, hasEventsForStimulus } from '$lib/data/engine'
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
        // Non-fixation visibility is a per-plot eye-movement-type SELECTION
        // (the 'eyeMovement' section) — an empty selection is "Fixations only".
        {
          kind: 'boolean',
          key: 'hideEvents',
          label: 'Events',
          group: 'Hide data',
          default: false,
          // Events ride as an overlay on the gaze segments; not shown in the
          // segment-index-based ordinal view.
          showWhen: (ctx: SectionFieldCtx) => {
            const timeline = ctx.common(s => s.timeline)
            const isOrdinal = !timeline.mixed && timeline.value === 'ordinal'
            return (
              hasEventsForStimulus(ctx.engine, ctx.settings.stimulusId as number) &&
              !isOrdinal
            )
          },
        },
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
      const kept = highlights.filter(h =>
        h.startsWith(SCARF_IDENTIFIERS.CATEGORY) ||
        h.startsWith(SCARF_IDENTIFIERS.EVENT)
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
          updates: [{ itemId: item.id, settings: { highlights: kept } }],
          source: 'plot.onCommand',
        })
      }
      return
    }
  },
})
