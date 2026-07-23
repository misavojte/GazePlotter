/**
 * Consolidated Scarf Plot Type Definitions
 *
 * This file contains all type definitions for the scarf plot component.
 * Types have been simplified and consolidated from the previous nested structure.
 */

import type { AdaptiveTimeline } from '$lib/plots/shared'

export type ScarfPlotSettings = {
  stimulusId: number
  groupId: number
  /** Per-plot AOI SELECTION id; unset/0 = all AOIs. */
  aoiSelectionId?: number
  /** Per-plot eye-movement-type SELECTION id; unset/0 = all types,
      NONE_SELECTION_ID = fixations only. */
  categorySelectionId?: number
  /** Per-plot event SELECTION id; unset/0 = all event channels,
      NONE_SELECTION_ID = overlay off. */
  eventSelectionId?: number
  timeline: 'absolute' | 'relative' | 'ordinal'
  absoluteStimuliLimits: [number, number][]
  ordinalStimuliLimits: [number, number][]
  highlights?: string[]
  timelineStart?: number
  timelineEnd?: number
  ordinalStart?: number
  ordinalEnd?: number
  /** Exclude fixations with no AOI coverage from timeline rendering. */
  hideNoAoi?: boolean
}


// ============================================================================
// Styling Types
// ============================================================================

/**
 * Styling information for a single scarf plot segment type.
 * Data-only: no layout or sizing information (heights are computed in presentation layer).
 *
 * @property name - Display name shown in the legend.
 * @property identifier - Unique identifier for this style (used for data binding and highlighting).
 * @property color - Fill/stroke color for the segment.
 */
export interface ScarfStyleItem {
  name: string
  identifier: string
  color: string
}

/**
 * Collection of styling information for the scarf plot.
 * Contains arrays for AOI styling, category styling, and event styling.
 */
export interface ScarfStyling {
  aoi: ScarfStyleItem[]
  category: ScarfStyleItem[]
  event: ScarfStyleItem[]
}

// ============================================================================
// Legend Types (Data-Only, No Layout)
// ============================================================================

/**
 * Style type for legend items, determining how the icon is rendered.
 * - 'fixation': Full-height rectangle (AOI fixations, event channels)
 * - 'nonFixation': Thin rectangle (saccades, other events)
 */
export type ScarfLegendStyleType = 'fixation' | 'nonFixation'

/**
 * A single legend item with its display properties.
 * This is data-only; layout geometry (including heights) is computed in the Svelte component.
 */
export interface ScarfLegendItem {
  /** Unique identifier for click handling and highlighting */
  identifier: string
  /** Display name shown next to the icon */
  name: string
  /** Color for the icon */
  color: string
  /** Semantic style type - the renderer uses this to determine appropriate heights */
  styleType: ScarfLegendStyleType
}

/**
 * A group of legend items with a descriptive title.
 * Groups provide semantic categorization (e.g., "Fixations", "Non-fixations", "AOI Visibility").
 */
export interface ScarfLegendGroup {
  /** Group title displayed above items */
  title: string
  /** Items belonging to this group */
  items: ScarfLegendItem[]
}

/**
 * Complete legend data structure for the scarf plot.
 * This is a data-only representation; geometry is computed at render time.
 */
export interface ScarfLegendData {
  groups: ScarfLegendGroup[]
}

// ============================================================================
// Participant Types
// ============================================================================

/**
 * Participant information for the scarf plot.
 * Contains the participant's ID, display label, and width in the plot.
 */
export interface ScarfParticipant {
  id: number
  label: string
  width: number // decimal 0-1 (instead of percentage string)
}

// ============================================================================
// Gaze render source (binary, single-pass)
// ============================================================================

/** Minimal structural view of the binary segment reader the gaze render needs
 *  (kept structural so this module doesn't import the data-engine types). */
export interface FusedSegmentReader {
  readonly segmentBufferRaw: Float32Array
  getSegmentRange(
    stimulusId: number,
    participantId: number
  ): { startIndex: number; endIndex: number }
}

/** Minimal structural view of the AOI group reader the fused gaze path needs. */
export interface FusedAoiGroupReader {
  getSegmentAoisUniqueDirect(
    segmentIndex: number,
    stimulusId: number,
    out: Uint16Array | Uint32Array
  ): number
}

/**
 * Everything the render/hover/highlight need to reproduce the gaze rects directly
 * from the binary segment store — WITHOUT materializing per-style rect buckets. The
 * gaze geometry is composited in one pass over the binary segments; per-participant
 * `projClip*`/`projScale` project raw start/end to the normalized [0,1] x-axis
 * (clamp-then-normalize), and the style maps resolve each segment's AOI/category to
 * a style index inline.
 */
export interface ScarfGazeSource {
  reader: FusedSegmentReader
  aoiGroupReader: FusedAoiGroupReader
  participantIds: number[]
  stimulusId: number
  /** Ordinal mode uses the segment's local index as its x-position (not time). */
  isOrdinal: boolean
  /** Per-participant-row visible-window bounds + scale (length = participants). */
  projClipMin: Float32Array
  projClipMax: Float32Array
  projScale: Float32Array
  /** raw AOI id → gaze style index (bucket index); -1 if not visible. */
  aoiOrderMap: Int16Array
  /** raw category id → gaze style index; -1 if not mapped. */
  categoryStyleIdxMap: Int16Array
  /** Style index of the "no AOI" fixation bucket (= number of visible AOIs), or
   *  -1 when `hideNoAoi` is set — the style doesn't exist then (the legend omits
   *  it and category styles occupy its index), so paint/hover/highlight skip
   *  no-AOI fixations by the index being unrepresentable. */
  noAoiStyleIdx: number
  /** Categories the paint loop skips — everything narrowed away by the plot's
   *  eye-movement-type SELECTION. */
  hiddenCategoryIds: Set<number>
}

// ============================================================================
// Main Scarf Data Type
// ============================================================================

/**
 * Object that contains all information needed to draw a scarf plot for a single stimulus.
 * It is generated from raw data and scarf settings by ScarfService.
 * Raw data are too complicated to be used directly in the scarf component.
 *
 * Layout geometry (bar/wrap/chart heights, label/plot-area widths) is computed
 * at render time from the live layout context, not stored here.
 *
 * @property id - Unique identifier for this scarf data instance
 * @property stimulusId - ID of the stimulus to be plotted
 * @property timeline - AdaptiveTimeline object containing information about the timeline ticks and bounds
 * @property stylingAndLegend - ScarfStyling object containing styling info for rendering segments
 * @property legendData - Group-aware legend data for viewport-driven legend rendering
 * @property participants - array of ScarfParticipant objects containing information about participants
 * @property gazeSource - binary source the renderer/hover/highlight composite gaze from
 * @property visualEventBuckets - Precomputed visual buffers for event strip markers
 */
export type ScarfData = {
  id: number
  stimulusId: number
  participants: ScarfParticipant[]
  timeline: AdaptiveTimeline
  /** Styling data for rendering segments */
  stylingAndLegend: ScarfStyling
  /** Group-aware legend data - geometry is computed at render time based on viewport */
  legendData: ScarfLegendData

  /**
   * Combined-mode (overlay) event-strip buffers per style, one array per style
   * index (OVERLAY_EVENT_STRIDE = 5): [xNormalized, pIndex, widthNormalized,
   * laneIndex, isPoint]. Events are still materialized (they are few); gaze is not.
   */
  visualEventBuckets: Float32Array[]

  /**
   * The gaze render source: the renderer, hover hit-test and highlight markers
   * composite/scan gaze segments straight from the binary segment store via this
   * (no intermediate per-style rect buffers). See {@link ScarfGazeSource}.
   */
  gazeSource: ScarfGazeSource

  /** Whether the event overlay (strips below the gaze baseline) is drawn. */
  isOverlay: boolean

  /**
   * Overlay only: observed max simultaneous events across all participants. The
   * event band height = this × lane height, uniform across rows so the AOI seam
   * sits at a constant y. 0 when there is no event band.
   */
  eventZoneConcurrency?: number
}

export interface ScarfRectStyle {
  normal: { fill: string }
  dimmed: { fill: string; opacity: number }
}

export interface ScarfEventStyle {
  normal: { fill: string; stroke: string; strokeWidth: number }
  dimmed: { fill: string; stroke: string; strokeWidth: number; opacity: number }
}

