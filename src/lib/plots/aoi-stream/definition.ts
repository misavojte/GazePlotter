import { deriveAoiStreamView, isAutoTimeline, type AoiStreamView } from './core/view'
import { computeMTop } from './core/ridgeline'
import { commonIs, definePlot } from '$lib/plots/definePlot'
import { stimulusParticipantsSubtitle } from '$lib/plots/shared'
// Called at definition time: import the module, not the barrel, which the
// registry -> shared sections -> registry cycle leaves half-initialised.
import { reconcileStimulusScopedHighlights } from '$lib/plots/shared/highlightReconcile'
import { prefixedHighlights } from '$lib/plots/shared/highlightLink'
import { OUT_OF_BOUNDS_COLORS, outOfBoundsFields } from '$lib/plots/shared/outOfBounds'
import { getAois, getParticipantsMaxEndTime } from '$lib/data/engine'
import { PRESET_PALETTES } from '$lib/color/palettes'
import { RIDGELINE_SCALE } from './const'
import type { AoiStreamPlotSettings } from './types'

// Mode-gated sub-controls hide while `alignment` diverges across a bulk
// selection — one plot's mode-specific options are meaningless for a mixed set.
const alignmentIs = (mode: string) => commonIs(s => s.alignment ?? 'stream', mode)

export const aoiStreamPlotDefinition = definePlot<
  'aoiStreamPlot',
  AoiStreamPlotSettings,
  AoiStreamView
>({
  type: 'aoiStreamPlot',
  name: 'AOI Timeline',
  tagline: 'AOI metric over time bins',
  group: 'metric',
  keywords: 'stream ridgeline over time',
  paneSections: [
    'stimulus',
    'participants',
    'metric',
    {
      key: 'aoiStreamPlot:visualization',
      title: 'Visualization',
      fields: [
        {
          kind: 'enum',
          key: 'alignment',
          options: [
            { label: 'Stream', value: 'stream', detail: 'Stacked around a centered baseline' },
            { label: 'Distribution', value: 'distribution', detail: 'Stacked on a zero baseline' },
            { label: 'Ridgeline', value: 'ridgeline', detail: 'One curve per AOI, offset' },
            { label: 'Heatmap', value: 'heatmap', detail: 'One row per AOI, colored by value' },
          ],
          default: 'stream',
          summary: true,
        },
        {
          kind: 'number',
          key: 'ridgelineScale',
          label: 'Ridge scale',
          min: 1,
          max: 10,
          step: 0.1,
          default: RIDGELINE_SCALE,
          showWhen: alignmentIs('ridgeline'),
        },
        {
          kind: 'stimulusColorRange',
          key: 'stimuliColorValueRanges',
          group: 'Color scale',
          showWhen: alignmentIs('heatmap'),
        },
        {
          kind: 'colorScale',
          key: 'colorScale',
          group: 'Color scale',
          defaultMin: PRESET_PALETTES.HEAT.colors[0],
          defaultMax: PRESET_PALETTES.HEAT.colors[2],
          showWhen: alignmentIs('heatmap'),
        },
        // No "Show text" toggles: heatmap bins are colored only, never printed.
        ...outOfBoundsFields({ labels: false, showWhen: alignmentIs('heatmap') }),
      ],
    },
    'timelineRange',
    'aoi',
  ],
  view: {
    deriveView: deriveAoiStreamView,
    viewDependsOnWidth: true,
    viewOnly: {
      settings: ['highlights'],
      input: s => ({ highlights: s.highlights ?? [] }),
    },
  },
  // x is absolute ms in all four alignments.
  cursor: { time: s => s.stimulusId },
  sync: [
    // Same-width plots with a fully-auto timeline share their timeline max, so
    // they compare directly. Customizing any range opts the plot out.
    {
      channel: 'aoi-stream-timeline',
      offer: ({ settings, item, engine }) =>
        isAutoTimeline(settings)
          ? {
              key: [item.w],
              own: getParticipantsMaxEndTime(engine, settings, settings.stimulusId),
            }
          : null,
      settings: (s, max) => ({ ...s, timelineEnd: max }),
    },
    // Ridgelines of the same height, scale and series count share the largest
    // mTop. Offered from the plot's OWN result and applied to strip rendering
    // only, so there is no feedback loop. The scale is rounded so float noise
    // never splits a group.
    {
      channel: 'aoi-stream-ridgeline',
      offer: ({ view, item }) => {
        if (!view || view.input.settings.alignment !== 'ridgeline') return null
        const { data, settings } = view.input
        if (data.noMetric || data.series.length === 0) return null
        return {
          key: [item.h, Math.round((settings.ridgelineScale ?? RIDGELINE_SCALE) * 1000), data.series.length],
          own: computeMTop(data, true),
        }
      },
      input: (_view, max) => ({ syncedMTopOverride: max }),
    },
  ],
  highlights: prefixedHighlights({ aoi: '', noAoi: '-1' }),
  getSubtitle: stimulusParticipantsSubtitle,
  getDefaultSettings: (params = {}) => ({
    stimulusId: params.stimulusId ?? 0,
    hideEmptyParticipants: false,
    metricInstanceIds: ['absoluteTime-aoi-windowed-500'],
    absoluteStimuliLimits: [],
    stimuliColorValueRanges: [],
    ...OUT_OF_BOUNDS_COLORS,
    timelineStart: 0,
    timelineEnd: 0,
    hideNoAoi: false,
  }),
  requireCapabilities: ['segmented'],
  // Highlights are bare AOI ids, every one stimulus-scoped; No AOI is -1.
  onCommand: reconcileStimulusScopedHighlights<AoiStreamPlotSettings>(
    () => true,
    (engine, s) => [...getAois(engine, s.stimulusId).map(a => String(a.id)), '-1']
  ),
  consumesMetrics: {
    outputShape: 'aoi-vector',
    windowing: 'required',
    crossParticipant: 'reduce',
  },
})
