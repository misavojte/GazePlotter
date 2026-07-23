import { deriveMetricMatrixView } from './core/view'
import { definePlot } from '$lib/plots/definePlot'
import { PRESET_PALETTES } from '$lib/color/palettes'
import {
  METRIC_MATRIX_CONTRACT,
  METRIC_MATRIX_DEFAULTS,
  metricMatrixSubtitle,
} from './const'
import type { MetricMatrixPlotSettings } from './types'

/**
 * Metric Matrix — participants (rows) × stimuli (columns), each cell one scalar
 * metric value, with no-data / not-usable cells rendered visually distinct from
 * low values. The un-reduced, per-participant consumer of a scalar instance: a
 * researcher scans the whole grid to see which recordings are trustworthy.
 * Consumes the shared `MatrixPlotFigure` via its `drawCells` seam — no `.svelte`
 * of its own.
 */
export const metricMatrixDefinition = definePlot<
  'metricMatrix',
  MetricMatrixPlotSettings
>({
  type: 'metricMatrix',
  name: 'Metric Matrix',
  group: 'per-participant',
  paneSections: [
    'group',
    'stimuli',
    'metric',
    {
      key: 'metricMatrix:visualisation',
      title: 'Visualisation',
      fields: [
        {
          kind: 'scaleRange',
          key: 'scaleRange',
          legend: 'Scale range',
        },
        {
          kind: 'colorScale',
          key: 'colorScale',
          defaultMin: PRESET_PALETTES.BLUE.colors[0],
          defaultMax: PRESET_PALETTES.BLUE.colors[2],
        },
      ],
      summary: () => 'Matrix',
    },
  ],
  view: { deriveView: deriveMetricMatrixView },
  getSubtitle: metricMatrixSubtitle,
  getDefaultSettings: (params = {}) => ({
    groupId: params.groupId ?? -1,
    metricInstanceIds: [METRIC_MATRIX_DEFAULTS.defaultMetricId],
    colorScale: [...METRIC_MATRIX_DEFAULTS.colorScale],
    // `0 = Auto`; the scaleRange field writes an explicit [min, max] here. Must
    // be materialised (the scaleRange field carries no self-default) or
    // registration throws for the whole registry.
    scaleRange: [0, 0],
  }),
  requireCapabilities: ['segmented'],
  consumesMetrics: METRIC_MATRIX_CONTRACT,
})
