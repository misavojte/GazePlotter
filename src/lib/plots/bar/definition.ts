import { deriveBarView } from './core/view'
import { barPlotScreen } from './core/screen.svelte'
import { definePlot, type SectionFieldCtx } from '$lib/plots/definePlot'
import { stimulusGroupSubtitle } from '$lib/plots/shared'
import { resolveInstance, getMetric } from '$lib/metrics'
import type { BarPlotSettings } from './types'

// Proportion metrics (e.g. noticed-rate) render as plain bars; the beeswarm
// statistical-overlay paradigm does not apply, so its picker is hidden.
const isProportion = (ctx: SectionFieldCtx): boolean => {
  const metricId = ctx.common(s => s.metricInstanceIds?.[0] ?? null)
  if (metricId.mixed || !metricId.value) return false
  const inst = resolveInstance(
    ctx.engine.metadata?.metricInstances ?? [],
    metricId.value as string
  )
  return inst
    ? getMetric(inst.baseId)?.meta.measurementClass === 'proportion'
    : false
}

export const barPlotDefinition = definePlot<'barPlot', BarPlotSettings>({
  type: 'barPlot',
  name: 'AOI Comparison',
  group: 'per-aoi',
  paneSections: [
    'stimulus',
    'group',
    'metric',
    {
      key: 'barPlot:visualisation',
      title: 'Visualisation',
      fields: [
        {
          kind: 'enum',
          key: 'statisticalOverlay',
          label: 'Statistical overlay',
          options: [
            { label: 'None', value: 'none' },
            { label: 'Mean ± 95% CI', value: 'meanCi95' },
            { label: 'Mean ± SD', value: 'meanSd' },
            { label: 'Boxplot', value: 'boxplot' },
          ],
          showWhen: ctx => !isProportion(ctx),
        },
        {
          kind: 'enum',
          key: 'barPlottingType',
          label: 'Orientation',
          options: [
            { label: 'Horizontal', value: 'horizontal' },
            { label: 'Vertical', value: 'vertical' },
          ],
        },
        {
          kind: 'enum',
          key: 'orderBy',
          label: 'Order by',
          options: [
            { label: 'Value', value: 'value' },
            { label: 'AOI order', value: 'aoi' },
          ],
        },
        {
          kind: 'enum',
          key: 'orderDirection',
          label: 'Direction',
          options: [
            { label: 'ASC', value: 'asc' },
            { label: 'DESC', value: 'desc' },
          ],
        },
        { kind: 'scaleRange', key: 'scaleRange', legend: 'Scale range' },
        { kind: 'hideNoAoi', key: 'hideNoAoi' },
      ],
      summary: ctx => {
        const orientation = ctx.common(s => s.barPlottingType)
        const overlay = ctx.common(s => s.statisticalOverlay)
        const o = orientation.mixed
          ? 'Mixed'
          : orientation.value === 'horizontal'
            ? 'Horizontal'
            : 'Vertical'
        if (isProportion(ctx)) return `${o} (Bars)`
        if (orientation.mixed || overlay.mixed) return 'Mixed'
        const ov =
          overlay.value === 'none'
            ? 'No overlay'
            : overlay.value === 'meanCi95'
              ? 'M ± 95% CI'
              : overlay.value === 'meanSd'
                ? 'M ± SD'
                : 'Boxplot'
        return `${o} (${ov})`
      },
    },
    'timelineRange',
    'aoi',
  ],
  view: { deriveView: deriveBarView },
  screen: barPlotScreen,
  getSubtitle: stimulusGroupSubtitle,
  getDefaultSettings: (params = {}) => ({
    stimulusId: params.stimulusId ?? 0,
    groupId: params.groupId ?? -1,
    barPlottingType: 'horizontal',
    orderBy: 'aoi',
    orderDirection: 'asc',
    metricInstanceIds: ['absoluteTime'],
    scaleRange: [0, 0],
    statisticalOverlay: 'meanCi95',
    timelineStart: 0,
    timelineEnd: 0,
    hideNoAoi: false,
  }),
  requireCapabilities: ['segmented'],
  consumesMetrics: {
    outputShape: 'aoi-vector',
    windowing: 'forbidden',
    crossParticipant: 'distribution',
  },
})
