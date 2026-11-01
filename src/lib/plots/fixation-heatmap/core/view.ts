import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { plotView } from '$lib/plots/definePlot'
import { formatGaze, formatQuantity, timeRangeQualifier, withQualifiers } from '$lib/plots/shared/labels'
import type { PlotPlaceholderContent } from '$lib/plots/shared/drawCanvasPlaceholder'
import { trailLengthOf } from '$lib/plots/shared/playbackFields'
import { fixationHeatmapKit } from './kit'
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
 * draws only at a shown moment, the resolution limit, and the fixations it
 * could not place.
 */
export function heatmapNotes(data: FixationHeatmapData, isVideo: boolean): string[] {
  const s = data.summary
  const notes = [
    isVideo && 'Video frame drawn only under a map of its moment',
    data.coarse && 'R below grid resolution, peaks read low',
    s.outside > 0 && `${fixations(s.outside)} outside the ${data.clip ? 'media' : 'view'}`,
    s.withoutCoordinates > 0 && `${fixations(s.withoutCoordinates)} without coordinates`,
    s.participantsWithout > 0 &&
      `${s.participantsWithout} of ${s.selected} participants without located fixations`,
  ]
  return notes.filter((n): n is string => typeof n === 'string')
}

/** What a fixation heatmap draws, screen and export. */
export function fixationHeatmapInput(engine: DataEngine, settings: FixationHeatmapPlotSettings) {
  const result = getFixationHeatmapData(engine, settings)
  const data = result.kind === 'ok' ? result.data : null
  const media = engine.metadata?.stimuliMedia?.[settings.stimulusId] ?? null
  // An image lies under the parked map. A video's frame is drawn only under a
  // map of the moment it shows (the playhead, or the moment saved for export):
  // a whole-range map over one arbitrary frame of a moving scene would mislead.
  const drawn = media && settings.background !== 'none' ? media : null
  const autoTop = niceCeil((data?.max ?? 0) * (settings.view === 'opacity' ? L.maskAutoTopShare : 1))
  return {
    settings,
    /** The parked map: every fixation of the time range. */
    data,
    dataEnd: data?.lastEnd ?? null,
    unavailableMessage: result.kind === 'ok' ? null : PLACEHOLDERS[result.reason],
    media: drawn,
    trailLength: trailLengthOf(settings, engine),
    /** Value at the top colour: a set Scale max, else the rounded peak (the color sync may raise it). */
    scaleTop: settings.scaleMax > 0 ? settings.scaleMax : autoTop,
    legendTitle: data ? heatmapLegendTitle(settings, data) : '',
    /** The title without its time qualifier; a playback frame appends its window's. */
    legendTitleBase: data ? heatmapLegendTitleBase(settings, data) : '',
    /** What the map leaves out; shown on hovering the legend title. */
    notes: data ? heatmapNotes(data, drawn?.kind === 'video') : [],
  }
}

export type FixationHeatmapInput = ReturnType<typeof fixationHeatmapInput>

/** What a fixation heatmap draws; an auto-scaled map also offers its scale to the color sync. */
export function deriveFixationHeatmapView(engine: DataEngine, settings: FixationHeatmapPlotSettings) {
  const input = fixationHeatmapInput(engine, settings)
  const { data } = input
  const meta =
    data && !(settings.scaleMax > 0)
      ? {
          /** Unsynced auto scale top. */
          ownScaleTop: input.scaleTop,
          /** Maps sharing it measure the same thing on the same colors. */
          syncGroupKey: [
            settings.accumulate,
            settings.normalization,
            data.radius,
            settings.view === 'opacity' ? `mask ${settings.maskColor}` : settings.colorScale.join('|'),
          ].join(';'),
        }
      : undefined
  return plotView(fixationHeatmapKit, input, { meta })
}

export type FixationHeatmapView = ReturnType<typeof deriveFixationHeatmapView>
