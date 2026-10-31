import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { figureView, type FigureProps, type PlotView } from '$lib/plots/definePlot'
import { formatGaze, formatQuantity, timeRangeQualifier, withQualifiers } from '$lib/plots/shared/labels'
import type { PlotPlaceholderContent } from '$lib/plots/shared/drawCanvasPlaceholder'
import { trailLengthOf } from '$lib/plots/shared/playbackFields'
import FixationHeatmapPlotFigure from '../components/FixationHeatmapPlotFigure.svelte'
import { getFixationHeatmapData } from './transformer'
import { FIXATION_HEATMAP_LAYOUT as L } from '../const'
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

/** Map values and amounts: whole from 100 up, one decimal from 1, two significant digits below. */
export const formatAmount = (v: number) =>
  Math.abs(v) >= 100 ? String(Math.round(v)) : Math.abs(v) >= 1 ? v.toFixed(1) : v.toPrecision(2)

/** Auto scale top: the peak rounded up at the third significant digit, so the key reads cleanly. */
export function niceCeil(v: number): number {
  if (!(v > 0)) return 0
  const step = 10 ** (Math.floor(Math.log10(v)) - 2)
  return Number((Math.ceil(v / step - 1e-9) * step).toPrecision(12))
}

/** Colorbar title without its time qualifier: the quantity, then R and N in math notation. */
export function heatmapLegendTitleBase(settings: FixationHeatmapPlotSettings, data: FixationHeatmapData): string {
  const quantity = settings.accumulate === 'duration' ? 'Fixation duration' : 'Fixation count'
  const share = settings.normalization === 'share'
  return withQualifiers(
    formatQuantity(share ? `${quantity} share` : quantity, heatmapUnit(settings)),
    `R = ${formatGaze(data.radius)}`,
    `N = ${data.participants.length}`
  )
}

/** Colorbar title in the labels.ts grammar; a playback frame swaps the time qualifier for its window. */
export function heatmapLegendTitle(settings: FixationHeatmapPlotSettings, data: FixationHeatmapData): string {
  return withQualifiers(
    heatmapLegendTitleBase(settings, data),
    timeRangeQualifier(settings.timelineStart ?? 0, settings.timelineEnd ?? 0)
  )
}

/**
 * What the map leaves out, for the legend title's tooltip: the background it
 * draws only during playback, the resolution limit, and the fixations it
 * could not place.
 */
export function heatmapNotes(data: FixationHeatmapData, isVideo: boolean): string[] {
  const s = data.summary
  const notes = [
    isVideo && 'Video frame drawn during playback only',
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
  // An image lies under the parked map. A video's frame is drawn only while
  // the playback clock has a time: a static map over one arbitrary frame of a
  // moving scene would mislead, so parked and exported maps sit on white.
  const drawn = media && settings.background !== 'none' ? media : null
  const opacityMap = settings.view === 'opacity'
  const autoTop = niceCeil(opacityMap ? data.max * L.maskAutoTopShare : data.max)
  const meta: FixationHeatmapViewMeta | undefined =
    settings.scaleMax > 0
      ? undefined
      : {
          ownScaleTop: autoTop,
          syncGroupKey: [
            settings.accumulate,
            settings.normalization,
            data.radius,
            opacityMap ? `mask ${settings.maskColor}` : settings.colorScale.join('|'),
          ].join(';'),
        }
  const opacity = opacityMap ? settings.maskOpacity : settings.opacity
  return figureView(
    FixationHeatmapPlotFigure,
    {
      data,
      colorScale: settings.colorScale,
      mask: opacityMap ? settings.maskColor : null,
      opacity: Math.min(100, Math.max(0, opacity)) / 100,
      scaleTop: settings.scaleMax > 0 ? settings.scaleMax : autoTop,
      fixedMax: settings.scaleMax > 0,
      showFixations: settings.showFixations,
      background: drawn ? settings.background : 'image',
      legendTitle: heatmapLegendTitle(settings, data),
      legendTitleBase: heatmapLegendTitleBase(settings, data),
      notes: heatmapNotes(data, drawn?.kind === 'video'),
      accumulate: settings.accumulate,
      normalization: settings.normalization,
      unavailableMessage: null,
      media: drawn,
      mediaStimulusId: settings.stimulusId,
      trailLength: trailLengthOf(settings, engine),
      playbackSpeed: settings.playbackSpeed,
      timelineStart: settings.timelineStart,
      timelineEnd: settings.timelineEnd,
    },
    { meta }
  )
}
