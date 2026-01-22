/**
 * Consolidated Scarf Plot Type Definitions
 *
 * This file contains all type definitions for the scarf plot component.
 * Types have been simplified and consolidated from the previous nested structure.
 */

import type { AdaptiveTimeline } from '$lib/plots/shared'

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
 * - 'fixation': Full-height rectangle (AOI fixations)
 * - 'nonFixation': Thin rectangle (saccades, other events)
 * - 'visibility': Dashed line (AOI visibility intervals)
 */
export type ScarfLegendStyleType = 'fixation' | 'nonFixation' | 'visibility'

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
// Segment Types
// ============================================================================

/**
 * A single segment in the scarf plot.
 * Represents a fixation or other gaze event with position, size, and metadata.
 */
export interface ScarfSegment {
  x: number // decimal 0-1 (instead of percentage string)
  width: number // decimal 0-1 (instead of percentage string)
  y: number
  height: number
  identifier: string
  orderId: number // Original segment order ID
}

// ============================================================================
// AOI Visibility Types
// ============================================================================

/**
 * A single AOI visibility entry.
 * Represents a time range when an AOI was visible.
 */
export interface ScarfAoiVisibility {
  x1: number // decimal 0-1 (instead of percentage string)
  x2: number // decimal 0-1 (instead of percentage string)
  y: number
  identifier: string
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
 * It is generated from raw data and scarf settings (height of bars etc.) by ScarfService.
 * Raw data are too complicated to be used directly in the scarf component.
 *
 * @property id - Unique identifier for this scarf data instance
 * @property timelineType - Type of timeline ('absolute', 'relative', 'ordinal')
 * @property stimulusId - ID of the stimulus to be plotted
 * @property timeline - AdaptiveTimeline object containing information about the timeline ticks and bounds
 * @property stylingAndLegend - ScarfStyling object containing styling info for rendering segments
 * @property legendData - Group-aware legend data for viewport-driven legend rendering
 * @property barHeight - height of the bar representing a single participant
 * @property heightOfBarWrap - height of the bar with all the elements (participant bar, aoi bars, non-fixation bars)
 * @property chartHeight - height of the whole chart
 * @property participants - array of ScarfParticipant objects containing information about participants
 * @property stimuli - array of ScarfStimulus objects containing information about stimuli (for stimuli selection)
 * @property leftLabelWidth - Precomputed layout width for left labels
 * @property plotAreaWidth - Precomputed layout width for the plot area
 * @property visualRectBuckets - Precomputed visual buffers for rectangle rendering
 * @property visualEventBuckets - Precomputed visual buffers for visibility event markers
 */
export type ScarfData = {
  id: number
  timelineType: string
  barHeight: number
  stimulusId: number
  heightOfBarWrap: number
  chartHeight: number
  stimuli: ScarfStimulus[]
  participants: ScarfParticipant[]
  timeline: AdaptiveTimeline
  /** Styling data for rendering segments */
  stylingAndLegend: ScarfStyling
  /** Group-aware legend data - geometry is computed at render time based on viewport */
  legendData: ScarfLegendData
  /**
   * Precomputed layout widths used by the renderer.
   * These must match the values used when constructing the visual buffers.
   */
  leftLabelWidth: number
  plotAreaWidth: number

  /**
   * Precomputed visual buffers (pixel coordinates) for canvas rendering.
   * Each array corresponds to one style index (bucketed by style during transformation).
   * This eliminates the need for runtime bucketing in Svelte.
   *
   * Rectangle buffer layout per style (RECT_STRIDE = 8):
   * [x, y, width, height, participantId, segmentId, orderId, reserved0]
   *
  * Event buffer layout per style (EVENT_STRIDE = 5):
  * [xNormalized, pIndex, eventType, participantId, reserved0]
   */
  visualRectBuckets: Float32Array[]
  visualEventBuckets: Float32Array[]
}

// ============================================================================
// Tooltip Types
// ============================================================================

/**
 * Data structure for scarf plot tooltips.
 * Contains positioning and identification information for tooltip display.
 */
export interface ScarfTooltipFillingType {
  x: number
  y: number
  width: number
  segmentId: number
  participantId: number
  stimulusId: number
}
