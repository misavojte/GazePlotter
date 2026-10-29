import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { figureView, type FigureProps, type PlotView } from '$lib/plots/definePlot'
import { formatGaze, formatQuantity, timeRangeQualifier, withQualifiers } from '$lib/plots/shared/labels'
import type { PlotPlaceholderContent } from '$lib/plots/shared/drawCanvasPlaceholder'
import FixationHeatmapPlotFigure from '../components/FixationHeatmapPlotFigure.svelte'
import { getFixationHeatmapData } from './transformer'
import type {
  FixationHeatmapData,
  FixationHeatmapPlotSettings,
  FixationHeatmapUnavailableReason,
} from '../types'

const PLACEHOLDERS: Record<FixationHeatmapUnavailableReason, PlotPlaceholderContent> = {
  'no-spatial-data': {
    message: 'Missing spatial coordinate data:',
    steps: ['Upload a dataset containing spatial information'],
  },
  'no-fixations': {
    message: 'No fixations for this participant selection on this stimulus.',
    steps: ['Pick another selection in Participants'],
  },
  'none-in-range': {
    message: 'No fixations in the selected time range.',
    steps: ['Widen or clear the Time range'],
  },
  'no-coordinates': {
    message: 'No fixation coordinates for this participant selection in the time range.',
    steps: ['Pick another selection in Participants'],
  },
  'none-on-media': {
    message: 'No fixations fall on the stimulus media.',
    steps: ['Check the media position in Edit stimuli & selections'],
  },
}

/** Map-value unit: % in share mode, else the accumulated unit (count is dimensionless). */
export function heatmapUnit(settings: Pick<FixationHeatmapPlotSettings, 'accumulate' | 'normalization'>): string {
  if (settings.normalization === 'share') return '%'
  return settings.accumulate === 'duration' ? 'ms' : ''
}

const fixations = (n: number) => `${n} fixation${n === 1 ? '' : 's'}`

/** Map values and amounts: whole from 100 up, one decimal from 1, two significant digits below; plain digits, no separators. */
export const formatAmount = (v: number) =>
  Math.abs(v) >= 100 ? String(Math.round(v)) : Math.abs(v) >= 1 ? v.toFixed(1) : v.toPrecision(2)

/** Auto scale top: the peak rounded up at the third significant digit, so the key reads cleanly. */
export function niceCeil(v: number): number {
  if (!(v > 0)) return 0
  const step = 10 ** (Math.floor(Math.log10(v)) - 2)
  return Number((Math.ceil(v / step - 1e-9) * step).toPrecision(12))
}

/** Colorbar title in the labels.ts grammar: the quantity, then R, N and t in math notation. */
export function heatmapLegendTitle(settings: FixationHeatmapPlotSettings, data: FixationHeatmapData): string {
  const quantity = settings.accumulate === 'duration' ? 'Fixation duration' : 'Fixation count'
  const share = settings.normalization === 'share'
  return withQualifiers(
    formatQuantity(share ? `${quantity} share` : quantity, heatmapUnit(settings)),
    `R = ${formatGaze(data.radius)}`,
    `N = ${data.participants.length}`,
    timeRangeQualifier(settings.timelineStart ?? 0, settings.timelineEnd ?? 0)
  )
}

/**
 * What the map leaves out, for the legend title's tooltip: the background it
 * cannot draw, the resolution limit, and the fixations it could not place.
 */
export function heatmapNotes(data: FixationHeatmapData, isVideo: boolean): string[] {
  const s = data.summary
  const notes = [
    isVideo && 'Video background not drawn',
    data.coarse && 'R below grid resolution, peaks read low',
    s.outside > 0 && `${fixations(s.outside)} outside the ${data.clip ? 'media' : 'view'}`,
    s.withoutCoordinates > 0 && `${fixations(s.withoutCoordinates)} without coordinates`,
    s.participantsWithout > 0 &&
      `${s.participantsWithout} of ${s.selected} participants without located fixations`,
  ]
  return notes.filter((n): n is string => typeof n === 'string')
}

/** Present only on an auto-scaled map: what the screen's color sync needs. */
export interface FixationHeatmapViewMeta {
  /** Unsynced auto scale top. */
  ownScaleTop: number
  /** Maps sharing it measure the same thing on the same colors. */
  syncGroupKey: string
}

export type FixationHeatmapView = PlotView<
  FigureProps<typeof FixationHeatmapPlotFigure>,
  FixationHeatmapViewMeta
>

/** Single source of truth for "what a fixation heatmap draws", screen and export alike. */
export function deriveFixationHeatmapView(
  engine: DataEngine,
  settings: FixationHeatmapPlotSettings
): FixationHeatmapView {
  const result = getFixationHeatmapData(engine, settings)
  if (result.kind !== 'ok') {
    return figureView(FixationHeatmapPlotFigure, {
      data: null,
      unavailableMessage: PLACEHOLDERS[result.reason],
    })
  }
  const { data } = result
  const media = engine.metadata?.stimuliMedia?.[settings.stimulusId] ?? null
  // Only an image is drawn: a video's shared element is the playback clock, so
  // its frame under a static map would move with any Scanpath of the stimulus.
  const image = media?.kind === 'image' && settings.background !== 'none' ? media : null
  const autoTop = niceCeil(data.max)
  const meta: FixationHeatmapViewMeta | undefined =
    settings.scaleMax > 0
      ? undefined
      : {
          ownScaleTop: autoTop,
          syncGroupKey: [settings.accumulate, settings.normalization, data.radius, settings.colorScale.join('|')].join(';'),
        }
  return figureView(
    FixationHeatmapPlotFigure,
    {
      data,
      colorScale: settings.colorScale,
      opacity: Math.min(100, Math.max(0, settings.opacity)) / 100,
      scaleTop: settings.scaleMax > 0 ? settings.scaleMax : autoTop,
      fixedMax: settings.scaleMax > 0,
      showFixations: settings.showFixations,
      background: image ? settings.background : 'image',
      legendTitle: heatmapLegendTitle(settings, data),
      notes: heatmapNotes(data, media?.kind === 'video'),
      accumulate: settings.accumulate,
      normalization: settings.normalization,
      unavailableMessage: null,
      media: image,
      mediaStimulusId: settings.stimulusId,
    },
    { meta }
  )
}
