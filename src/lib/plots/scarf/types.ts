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
 * Used for AOIs, categories, and visibility items in the legend.
 *
 * @property name - Name of the segment type shown in the legend.
 * @property identifier - Identifier of the segment type (used for connecting with the data).
 * @property color - Color of the segment type.
 * @property height - Height of the segment type.
 * @property heighOfLegendItem - Height of the legend item.
 */
export interface ScarfStyleItem {
  name: string
  identifier: string
  color: string
  height: number
  heighOfLegendItem: number
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
 * @property stylingAndLegend - ScarfStyling object containing information about the styling of the scarf plot
 * @property barHeight - height of the bar representing a single participant
 * @property heightOfBarWrap - height of the bar with all the elements (participant bar, aoi bars, non-fixation bars)
 * @property chartHeight - height of the whole chart
 * @property participants - array of ScarfParticipant objects containing information about participants
 * @property stimuli - array of ScarfStimulus objects containing information about stimuli (for stimuli selection)
 * @property leftLabelWidth - Precomputed layout width for left labels
 * @property plotAreaWidth - Precomputed layout width for the plot area
 * @property visualRectBuckets - Precomputed visual buffers for rectangle rendering
 * @property visualLineBuckets - Precomputed visual buffers for line rendering
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
  stylingAndLegend: ScarfStyling
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
   * Line buffer layout per style (LINE_STRIDE = 6):
   * [x1, y1, x2, y2, participantId, reserved0]
   */
  visualRectBuckets: Float32Array[]
  visualLineBuckets: Float32Array[]
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
