export interface GridType {
  id: number
  x: number
  y: number
  w: number
  h: number
  min: { w: number; h: number }
  type: 'scarf' | 'TransitionMatrix' | 'barPlot'
  redrawTimestamp: number
}

export interface ScarfGridType extends GridType {
  type: 'scarf'
  stimulusId: number
  groupId: number
  zoomLevel: number
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
  dynamicAOI: boolean
}

export interface TransitionMatrixGridType extends GridType {
  type: 'TransitionMatrix'
  stimulusId: number
  groupId: number
  stimuliColorValueRanges: [number, number][] // Per-stimulus color ranges
  aggregationMethod: string // Store the aggregation method in settings
  // Display options for values outside the color range
  belowMinColor: string // Color for values below minimum (default: gray)
  aboveMaxColor: string // Color for values above maximum (default: gray)
  showBelowMinLabels: boolean // Whether to show labels for values below minimum (default: false)
  showAboveMaxLabels: boolean // Whether to show labels for values above maximum (default: false)
  // Custom color scale (2 or 3 points gradient)
  colorScale: string[] // Array of 2 or 3 colors for gradient (min, [middle], max)
}

export interface BarPlotGridType extends GridType {
  type: 'barPlot'
  stimulusId: number
  groupId: number
  barPlottingType: 'vertical' | 'horizontal'
  sortBars: 'none' | 'ascending' | 'descending' // Sorting option for bars
  aggregationMethod:
    | 'absoluteTime'
    | 'relativeTime'
    | 'timeToFirstFixation'
    | 'avgFixationDuration'
    | 'avgFirstFixationDuration'
    | 'averageFixationCount'
  /**
   * Scale range in [start, end] format.
   * For start (index 0): The minimum value for the scale.
   * For end (index 1): The maximum value for the scale. 0 means automatically use the data range.
   */
  scaleRange: [number, number]
}

// now create a type that is a union of all the grid types
export type AllGridTypes =
  | ScarfGridType
  | TransitionMatrixGridType
  | BarPlotGridType
