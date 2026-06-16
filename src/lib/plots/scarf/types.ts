/**
 * Consolidated Scarf Plot Type Definitions
 *
 * This file contains all type definitions for the scarf plot component.
 * Types have been simplified and consolidated from the previous nested structure.
 */

import type { AdaptiveTimeline } from '$lib/plots/shared'
import type { PlotItemContract } from '$lib/plots/definePlot'

export type ScarfPlotSettings = {
  stimulusId: number
  groupId: number
  timeline: 'absolute' | 'relative' | 'ordinal'
  absoluteStimuliLimits: [number, number][]
  ordinalStimuliLimits: [number, number][]
  highlights?: string[]
  timelineStart?: number
  timelineEnd?: number
  ordinalStart?: number
  ordinalEnd?: number
  hideNonFixations?: boolean
  /** Hide the event overlay (strips below the gaze baseline). Default: shown. */
  hideEvents?: boolean
}

export type ScarfPlotItem = PlotItemContract<'scarf', ScarfPlotSettings>

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
 * Contains arrays for AOI styling, category styling, and visibility styling.
 */
export interface ScarfStyling {
  aoi: ScarfStyleItem[]
  category: ScarfStyleItem[]
  visibility: ScarfStyleItem[]
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
// Stimulus Types
// ============================================================================

/**
 * Object representing a single stimulus in the scarf plot selection box of stimuli.
 * @property id - ID of the stimulus
 * @property name - displayed name of the stimulus
 */
export interface ScarfStimulus {
  id: number
  name: string
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
 * @property stimuli - array of ScarfStimulus objects containing information about stimuli (for stimuli selection)
 * @property visualRectBuckets - Precomputed visual buffers for rectangle rendering
 * @property visualEventBuckets - Precomputed visual buffers for visibility event markers
 */
export type ScarfData = {
  id: number
  stimulusId: number
  stimuli: ScarfStimulus[]
  participants: ScarfParticipant[]
  timeline: AdaptiveTimeline
  /** Styling data for rendering segments */
  stylingAndLegend: ScarfStyling
  /** Group-aware legend data - geometry is computed at render time based on viewport */
  legendData: ScarfLegendData

  /**
   * Precomputed visual buffers (pixel coordinates) for canvas rendering.
   * Each array corresponds to one style index (bucketed by style during transformation).
   * This eliminates the need for runtime bucketing in Svelte.
   *
   * Rectangle buffer layout per style (RECT_STRIDE = 8):
   * [x, participantIndex, width, height, participantId, segmentId, orderId, internalY]
   *
   * Combined-mode (overlay) event-strip buffer per style
   * (OVERLAY_EVENT_STRIDE = 5):
   * [xNormalized, pIndex, widthNormalized, laneIndex, isPoint]
   */
  visualRectBuckets: Float32Array[]
  visualEventBuckets: Float32Array[]

  /**
   * Per-rect-bucket row index for hover hit-testing. `rectRowOffsets[styleIdx]`
   * is an Int32Array of length (participants + 1) where entry r is the first
   * segment index in that bucket with participantIndex >= r. The segments of
   * row r are the half-open slice [r, r + 1), so the hover hit-test scans only
   * the hovered row instead of the whole buffer. Same length/order as
   * `visualRectBuckets`.
   */
  rectRowOffsets: Int32Array[]

  /** Whether the event overlay (strips below the gaze baseline) is drawn. */
  isOverlay: boolean

  /**
   * Overlay only: observed max simultaneous events across all participants. The
   * event band height = this × lane height, uniform across rows so the AOI seam
   * sits at a constant y. 0 when there is no event band.
   */
  eventZoneConcurrency?: number
}

/**
 * Tooltip data for a specific point on the scarf plot.
 */
export interface ScarfTooltipData {
  x: number
  y: number
  width: number
  segmentId: number
  participantId: number
  stimulusId: number
}

export interface ScarfRectStyle {
  normal: { fill: string }
  dimmed: { fill: string; opacity: number }
}

export interface ScarfEventStyle {
  normal: { fill: string; stroke: string; strokeWidth: number }
  dimmed: { fill: string; stroke: string; strokeWidth: number; opacity: number }
}

