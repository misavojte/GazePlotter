/**
 * Base interface representing a grid item in the workspace.
 * This type defines the common properties shared by all grid items,
 * including their position, dimensions, and type.
 */
export interface GridType {
  /** Unique identifier for the grid item */
  id: number
  /** X-coordinate position of the grid item */
  x: number
  /** Y-coordinate position of the grid item */
  y: number
  /** Width of the grid item */
  w: number
  /** Height of the grid item */
  h: number
  /** Minimum dimensions that the grid item can be resized to */
  min: { w: number; h: number }
  /** Type of visualization represented by this grid item */
  type: 'scarf' | 'TransitionMatrix' | 'barPlot'
  /** Timestamp used to trigger redraws of the grid item */
  redrawTimestamp: number
}

/**
 * Interface representing a Scarf plot grid item.
 * Extends the base GridType with Scarf-specific properties.
 */
export interface ScarfGridType extends GridType {
  type: 'scarf'
  /** ID of the stimulus being visualized */
  stimulusId: number
  /** ID of the group being visualized */
  groupId: number
  /** Type of timeline used for visualization */
  timeline: 'absolute' | 'relative' | 'ordinal'
  /**
   * Stimulus-specific ranges for absolute timeline in [start, end] format.
   * For start (index 0): 0 means start at the beginning of the timeline.
   * For end (index 1): 0 means automatically use the full data range.
   */
  absoluteStimuliLimits: [number, number][]
  /**
   * Stimulus-specific ranges for ordinal timeline in [start, end] format.
   * For start (index 0): 0 means start at the beginning of the timeline.
   * For end (index 1): 0 means automatically use the full data range.
   */
  ordinalStimuliLimits: [number, number][]
  /** Whether to use dynamic AOI (Area of Interest) calculations */
  dynamicAOI: boolean
}

/**
 * Interface representing a Transition Matrix grid item.
 * Extends the base GridType with Transition Matrix-specific properties.
 */
export interface TransitionMatrixGridType extends GridType {
  type: 'TransitionMatrix'
  /** ID of the stimulus being visualized */
  stimulusId: number
  /** ID of the group being visualized */
  groupId: number
  /** Per-stimulus color value ranges for visualization */
  stimuliColorValueRanges: [number, number][]
  /** Method used for aggregating transition data */
  aggregationMethod: string
  /** Color for values below the minimum range */
  belowMinColor: string
  /** Color for values above the maximum range */
  aboveMaxColor: string
  /** Whether to show labels for values below minimum */
  showBelowMinLabels: boolean
  /** Whether to show labels for values above maximum */
  showAboveMaxLabels: boolean
  /** Array of 2 or 3 colors for gradient (min, [middle], max) */
  colorScale: string[]
}

/**
 * Interface representing a Bar Plot grid item.
 * Extends the base GridType with Bar Plot-specific properties.
 */
export interface BarPlotGridType extends GridType {
  type: 'barPlot'
  /** ID of the stimulus being visualized */
  stimulusId: number
  /** ID of the group being visualized */
  groupId: number
  /** Orientation of the bar plot */
  barPlottingType: 'vertical' | 'horizontal'
  /** Method for sorting the bars */
  sortBars: 'none' | 'ascending' | 'descending'
  /** Method used for aggregating the data */
  aggregationMethod:
    | 'absoluteTime'
    | 'relativeTime'
    | 'timeToFirstFixation'
    | 'avgFixationDuration'
    | 'avgFirstFixationDuration'
    | 'averageFixationCount'
    | 'hitRatio'
  /**
   * Scale range in [start, end] format.
   * For start (index 0): The minimum value for the scale.
   * For end (index 1): The maximum value for the scale. 0 means automatically use the data range.
   */
  scaleRange: [number, number]
}

/**
 * Union type representing all possible grid item types in the workspace.
 */
export type AllGridTypes =
  | ScarfGridType
  | TransitionMatrixGridType
  | BarPlotGridType
