import { deriveAoiStreamView } from './core/view'
import { aoiStreamScreen } from './core/screen.svelte'
import { definePlot, type SectionFieldCtx } from '$lib/plots/definePlot'
import { stimulusGroupSubtitle } from '$lib/plots/shared'
// Called at definition time: import the module, not the barrel, which the
// registry -> shared sections -> registry cycle leaves half-initialised.
import { reconcileStimulusScopedHighlights } from '$lib/plots/shared/highlightReconcile'
import { OUT_OF_BOUNDS_COLORS, outOfBoundsFields } from '$lib/plots/shared/outOfBounds'
import { getAois } from '$lib/data/engine'
import { PRESET_PALETTES } from '$lib/color/palettes'
import { RIDGELINE_SCALE } from './const'
import type { AoiStreamPlotSettings } from './types'

// Mode-gated sub-controls hide while `alignment` diverges across a bulk
// selection — one plot's mode-specific options are meaningless for a mixed set.
const alignmentIs = (mode: string) => (ctx: SectionFieldCtx) => {
  const a = ctx.common(s => s.alignment ?? 'stream')
  return !a.mixed && a.value === mode
}

export const aoiStreamPlotDefinition = definePlot<
  'aoiStreamPlot',
  AoiStreamPlotSettings
>({
  type: 'aoiStreamPlot',
  name: 'AOI Timeline',
  group: 'per-aoi',
  paneSections: [
    'stimulus',
    'group',
    'metric',
    {
      key: 'aoiStreamPlot:visualisation',
      title: 'Visualisation',
      fields: [
        {
          kind: 'enum',
          key: 'alignment',
          options: [
            { label: 'Stream', value: 'stream' },
            { label: 'Distribution', value: 'distribution' },
            { label: 'Ridgeline', value: 'ridgeline' },
            { label: 'Heatmap', value: 'heatmap' },
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
    viewOnlySettings: ['highlights'],
  },
  screen: aoiStreamScreen,
  getSubtitle: stimulusGroupSubtitle,
  getDefaultSettings: (params = {}) => ({
    stimulusId: params.stimulusId ?? 0,
    groupId: params.groupId ?? -1,
    metricInstanceIds: ['absoluteTime-aoi-windowed-500'],
    absoluteStimuliLimits: [],
    stimuliColorValueRanges: [],
    ...OUT_OF_BOUNDS_COLORS,
    timelineStart: 0,
    timelineEnd: 0,
    hideNoAoi: false,
  }),
  requireCapabilities: ['segmented'],
  // Highlights are bare AOI ids — every one is stimulus-scoped.
  onCommand: reconcileStimulusScopedHighlights<AoiStreamPlotSettings>(
    () => true,
    (engine, s) => getAois(engine, s.stimulusId).map(a => String(a.id))
  ),
  consumesMetrics: {
    outputShape: 'aoi-vector',
    windowing: 'required',
    crossParticipant: 'reduce',
  },
})
