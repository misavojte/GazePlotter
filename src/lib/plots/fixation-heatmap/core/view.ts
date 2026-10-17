import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { PlotView } from '$lib/plots/definePlot'
import { ALL_SELECTION_LABEL } from '$lib/data/types'
import { getParticipantsSelectionOptions } from '$lib/plots/shared/selectOptionsGetters'
import { optionLabel } from '$lib/plots/shared/subtitles'
import { formatQuantity, timeRangeQualifier, withQualifiers } from '$lib/plots/shared/labels'
import type { PlotPlaceholderContent } from '$lib/plots/shared/drawCanvasPlaceholder'
import FixationHeatmapPlotFigure from '../components/FixationHeatmapPlotFigure.svelte'
import { SIGMA_PER_RADIUS } from './density'
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
  'no-coordinates': 'No fixation coordinates for this participant selection in the time range.',
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

/** Gaze units: whole numbers at pixel scale, three significant digits for normalized data. */
export const formatGaze = (v: number) => (Math.abs(v) >= 10 ? String(Math.round(v)) : String(Number(v.toPrecision(3))))

const formatCount = (n: number) => n.toLocaleString('en-US')

/** Map values and amounts: separators from 100 up, one decimal from 1, two significant digits below. */
export const formatAmount = (v: number) =>
  Math.abs(v) >= 100 ? Math.round(v).toLocaleString('en-US') : Math.abs(v) >= 1 ? v.toFixed(1) : v.toPrecision(2)

/** Auto scale top: the peak rounded up at the third significant digit, so the key reads cleanly. */
export function niceCeil(v: number): number {
  if (!(v > 0)) return 0
  const step = 10 ** (Math.floor(Math.log10(v)) - 2)
  return Number((Math.ceil(v / step - 1e-9) * step).toPrecision(12))
}

/** Colorbar title in the labels.ts grammar: what the colour means, short enough to fit two lines. */
export function heatmapLegendTitle(settings: FixationHeatmapPlotSettings, data: FixationHeatmapData): string {
  const quantity = settings.accumulate === 'duration' ? 'Fixation duration' : 'Fixation count'
  const share = settings.normalization === 'share'
  const n = data.participants.length
  return withQualifiers(
    formatQuantity(share ? `${quantity} share` : quantity, heatmapUnit(settings)),
    settings.scaleMax > 0 ? 'max fixed' : 'max auto',
    `mean of ${n} participant${n === 1 ? '' : 's'}`,
    timeRangeQualifier(settings.timelineStart ?? 0, settings.timelineEnd ?? 0)
  )
}

/**
 * The figure's self-documenting line, never removed: the selection and the
 * kernel first, then the warnings an export must keep, the fixation count last.
 */
export function heatmapSummary(
  engine: DataEngine,
  settings: FixationHeatmapPlotSettings,
  data: FixationHeatmapData,
  isVideo: boolean
): string {
  const s = data.summary
  const selection =
    optionLabel(getParticipantsSelectionOptions(engine, true, settings.stimulusId), settings.groupId) ?? ALL_SELECTION_LABEL
  const unit = heatmapUnit(settings)
  const amount = (v: number) => `${formatAmount(v)}${unit ? ` ${unit}` : ''}`
  const clauses = [
    selection,
    `R = ${formatGaze(data.radius)}${data.radiusIsAuto ? ' auto' : ''}`,
    `σ = ${formatGaze(data.radius * SIGMA_PER_RADIUS)}`,
    settings.scaleMax > 0 && data.max > settings.scaleMax && `peak ${amount(data.max)} > max ${amount(settings.scaleMax)}`,
    isVideo && 'video background not drawn',
    data.coarse && 'R below grid resolution · peaks read low',
    s.outside > 0 && `${formatCount(s.outside)} outside ${data.clip ? 'media' : 'view'}`,
    s.withoutCoordinates > 0 && `${formatCount(s.withoutCoordinates)} without coordinates`,
    s.participantsWithout > 0 &&
      `${s.participantsWithout} of ${s.selected} participants without located fixations`,
    `${formatCount(s.fixations)} fixation${s.fixations === 1 ? '' : 's'}`,
  ]
  return clauses.filter((c): c is string => typeof c === 'string').join(' · ')
}

/** Single source of truth for "what a fixation heatmap draws", screen and export alike. */
export function deriveFixationHeatmapView(
  engine: DataEngine,
  settings: FixationHeatmapPlotSettings
): PlotView {
  const result = getFixationHeatmapData(engine, settings)
  if (result.kind !== 'ok') {
    return {
      component: FixationHeatmapPlotFigure,
      props: { data: null, unavailableMessage: PLACEHOLDERS[result.reason] },
    }
  }
  const { data } = result
  const media = engine.metadata?.stimuliMedia?.[settings.stimulusId] ?? null
  // Only an image is drawn: a video's shared element is the playback clock, so
  // its frame under a static map would move with any Scanpath of the stimulus.
  const image = media?.kind === 'image' && settings.background !== 'none' ? media : null
  return {
    component: FixationHeatmapPlotFigure,
    props: {
      data,
      colorScale: settings.colorScale,
      opacity: Math.min(100, Math.max(0, settings.opacity)) / 100,
      scaleTop: settings.scaleMax > 0 ? settings.scaleMax : niceCeil(data.max),
      fixedMax: settings.scaleMax > 0,
      showFixations: settings.showFixations,
      background: image ? settings.background : 'image',
      legendTitle: heatmapLegendTitle(settings, data),
      summaryText: heatmapSummary(engine, settings, data, media?.kind === 'video'),
      accumulate: settings.accumulate,
      normalization: settings.normalization,
      unavailableMessage: null,
      media: image,
      mediaStimulusId: settings.stimulusId,
      mediaStore: engine.media,
    },
  }
}
