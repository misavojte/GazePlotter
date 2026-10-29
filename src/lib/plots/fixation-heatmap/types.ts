import type { StimulusBackground } from '$lib/plots/shared/stimulusBackground'
import type { Rect } from '$lib/data/media/mediaAlignment'
import type { GridGeometry } from './core/density'
import type { ParticipantScope } from '$lib/data/types'

export type FixationHeatmapAccumulate = 'duration' | 'count'
export type FixationHeatmapNormalization = 'share' | 'mean'
/** Heatmap: colour rises with the value. Opacity map: a mask that clears as it rises. */
export type FixationHeatmapViewKind = 'heatmap' | 'opacity'
export type FixationHeatmapPlotSettings = ParticipantScope & {
  stimulusId: number
  /** What a fixation adds: its (clipped) duration, or 1 when its midpoint is in range. */
  accumulate: FixationHeatmapAccumulate
  /** Share: each participant's weights over their own total, in %, then averaged.
      Mean: weights averaged over participants, in the accumulated unit. */
  normalization: FixationHeatmapNormalization
  /** Kernel radius in gaze units (sigma = R / 3); 0 = Auto. */
  radius: number
  view: FixationHeatmapViewKind
  colorScale: string[]
  /** Value at the top colour, in the map's unit; 0 = Auto (the map's own peak). */
  scaleMax: number
  /** Heat overlay opacity [%]. */
  opacity: number
  /** Opacity map: the mask's colour, and its opacity [%] where the map is 0. */
  maskColor: string
  maskOpacity: number
  showFixations: boolean
  /** The image as is, desaturated, desaturated and faded, or not drawn (Pro Lab's White). */
  background: StimulusBackground
  timelineStart?: number
  timelineEnd?: number
}

/** One contributing participant: W_j > 0. */
export interface HeatmapParticipant {
  id: number
  name: string
  /** W_j: total accumulated weight of the participant's located, in-range fixations. */
  total: number
}

/** What the map leaves out or bends, for the data summary line. */
export interface HeatmapDataSummary {
  /** Located, in-range fixations of the selection: the map's input. */
  fixations: number
  /** In-range fixations without coordinates (never placed, never in W_j). */
  withoutCoordinates: number
  /** Located fixations outside what is drawn: the media rect, or the view. */
  outside: number
  /** Selected participants recorded on the stimulus without a located fixation in range (not in N). */
  participantsWithout: number
  /** Selected participants recorded on the stimulus. */
  selected: number
}

export interface FixationHeatmapData {
  grid: GridGeometry
  /** Kernel-weighted map value per cell, row-major (cols x rows). */
  values: Float32Array
  /** Peak over the shown cells: inside the media rect with media, else all. */
  max: number
  radius: number
  /** True when the grid cell is too coarse for R and peaks read low (a small R on a large extent). */
  coarse: boolean
  /** The gaze rectangle the view frames: the media region, or the fixations' extent. */
  extent: Rect
  /** Heat is clipped to the media rect; null without media. */
  clip: Rect | null
  /** Located, in-range fixations of the selection. */
  xs: Float32Array
  ys: Float32Array
  /** Accumulated weight before normalisation (ms or 1). */
  raw: Float32Array
  /** Index into `participants`. */
  participantIndex: Uint32Array
  participants: HeatmapParticipant[]
  summary: HeatmapDataSummary
}

export type FixationHeatmapUnavailableReason =
  | 'no-spatial-data'
  | 'no-fixations'
  | 'none-in-range'
  | 'no-coordinates'
  | 'none-on-media'

export type FixationHeatmapTransformResult =
  | { kind: 'ok'; data: FixationHeatmapData }
  | { kind: 'unavailable'; reason: FixationHeatmapUnavailableReason }
