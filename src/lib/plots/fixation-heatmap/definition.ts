import { deriveFixationHeatmapView, heatmapUnit } from './core/view'
import { autoRadiusFor } from './core/transformer'
import { plotCursorScreen } from '$lib/plots/shared/plotCursor.svelte'
import { commonIs, definePlot, type SectionFieldCtx } from '$lib/plots/definePlot'
import { formatGaze, stimulusGroupSubtitle } from '$lib/plots/shared'
import { PRESET_PALETTES } from '$lib/color/palettes'
import type { FixationHeatmapPlotSettings } from './types'

/** The unit a Scale max is typed in, or null when the edited plots disagree. */
function scaleUnit(ctx: SectionFieldCtx): string | null {
  const v = ctx.common(s => heatmapUnit(s as FixationHeatmapPlotSettings))
  return v.mixed ? null : v.value || 'fixations'
}

export const fixationHeatmapDefinition = definePlot<'fixationHeatmap', FixationHeatmapPlotSettings>({
  type: 'fixationHeatmap',
  name: 'Fixation Heatmap',
  tagline: 'Pooled fixations on the stimulus',
  group: 'gaze-behavior',
  paneSections: [
    'stimulus',
    'group',
    {
      key: 'fixationHeatmap:method',
      title: 'Method',
      defaultOpen: true,
      // Doubles as the reportable one-liner: what was accumulated, how, with which kernel.
      summary: ctx => {
        const method = ctx.common(s => {
          const h = s as FixationHeatmapPlotSettings
          const radius = h.radius > 0 ? `R ${formatGaze(h.radius)}` : 'R auto'
          return `${h.accumulate === 'count' ? 'Count' : 'Duration'}, ${h.normalization === 'mean' ? 'mean' : 'share'}, ${radius}`
        })
        return method.mixed ? 'Mixed (varies)' : method.value
      },
      fields: [
        {
          kind: 'enum',
          key: 'accumulate',
          label: 'Accumulate',
          options: [
            { label: 'Fixation duration', value: 'duration', detail: 'Clipped to the time range' },
            { label: 'Fixation count', value: 'count', detail: 'Fixations whose midpoint is in the time range' },
          ],
        },
        {
          kind: 'enum',
          key: 'normalization',
          label: 'Normalization',
          options: [
            {
              label: 'Share per participant',
              value: 'share',
              detail: "Each participant's share of their own total, averaged [%]",
            },
            {
              label: 'Mean per participant',
              value: 'mean',
              detail: 'Averaged over participants; longer viewers weigh more',
            },
          ],
        },
        {
          kind: 'number',
          key: 'radius',
          label: ctx => {
            const auto = autoRadiusFor(ctx.engine, (ctx.settings.stimulusId as number) ?? 0)
            // "R" names the radius the figure summary and tooltip report.
            return auto === null ? 'Radius R (0 = Auto)' : `Radius R (0 = Auto: ${formatGaze(auto)})`
          },
          min: 0,
          // A tenth of the auto radius's magnitude: 1 for pixel data, 0.001 for normalized.
          step: ctx => {
            const auto = autoRadiusFor(ctx.engine, (ctx.settings.stimulusId as number) ?? 0)
            return auto ? 10 ** (Math.floor(Math.log10(auto)) - 1) : 1
          },
          default: 0,
        },
      ],
    },
    {
      key: 'fixationHeatmap:visualization',
      title: 'Visualization',
      summary: () => 'Heatmap',
      fields: [
        {
          kind: 'colorScale',
          key: 'colorScale',
          group: 'Color scale',
          defaultMin: PRESET_PALETTES.YL_OR_RD.colors[0],
          defaultMax: PRESET_PALETTES.YL_OR_RD.colors[2],
        },
        {
          kind: 'number',
          key: 'scaleMax',
          group: 'Color scale',
          label: ctx => {
            const unit = scaleUnit(ctx)
            return unit ? `Scale max [${unit}] (0 = Auto)` : 'Scale max (0 = Auto)'
          },
          min: 0,
          step: ctx => (scaleUnit(ctx) === 'ms' ? 10 : 0.1),
          default: 0,
        },
        {
          kind: 'number',
          key: 'opacity',
          group: 'Color scale',
          label: 'Opacity [%]',
          min: 0,
          max: 100,
          step: 5,
          default: 70,
        },
        {
          kind: 'enum',
          key: 'background',
          label: 'Background',
          options: [
            { label: 'Image', value: 'image', detail: 'Image in full color' },
            { label: 'Grayscale image', value: 'grayscale', detail: 'Image without color, so heat colors stand out' },
            { label: 'Dimmed grayscale image', value: 'dimmed', detail: 'Grayscale image faded toward white' },
            { label: 'None', value: 'none', detail: 'Heat only, within the image outline' },
          ],
          // Every edited plot must show an image, or the control would be dead on some.
          showWhen: commonIs((s, ctx) => ctx.engine.metadata?.stimuliMedia?.[s.stimulusId ?? 0]?.kind === 'image', true),
        },
        { kind: 'boolean', key: 'showFixations', label: 'Show fixations' },
      ],
    },
    'timelineRange',
  ],
  view: { deriveView: deriveFixationHeatmapView },
  screen: plotCursorScreen(),
  getSubtitle: stimulusGroupSubtitle,
  // A Scale max is typed in the map's unit; when the unit changes it no longer
  // means anything (5000 ms as a count blanks the map), so it returns to Auto.
  onCommand: (command, item, _engine, dispatch): void => {
    if (command.type !== 'updateSettings') return
    const patch = command.updates.find(u => u.itemId === item.id)?.settings
    if (!patch || 'scaleMax' in patch) return
    if (!('accumulate' in patch) && !('normalization' in patch)) return
    if (!(item.settings.scaleMax > 0)) return
    dispatch({
      type: 'updateSettings',
      updates: [{ itemId: item.id, settings: { scaleMax: 0 } }],
      source: 'plot.onCommand',
    })
  },
  getDefaultSettings: (params = {}) => ({
    stimulusId: params.stimulusId ?? 0,
    groupId: params.groupId ?? -1,
    accumulate: 'duration',
    normalization: 'share',
    radius: 0,
    colorScale: [...PRESET_PALETTES.YL_OR_RD.colors],
    scaleMax: 0,
    opacity: 70,
    showFixations: false,
    background: 'image',
  }),
  size: { min: { w: 12, h: 10 }, w: 16, h: 13 },
  requireCapabilities: ['segmented', 'spatial'],
})
