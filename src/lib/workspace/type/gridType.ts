/**
 * Configuration type for visualization registry entries.
 * Defines the structure for each visualization type in the registry.
 */
export type VisualizationConfig<K extends keyof GridItemMap> = {
  name: string
  component: any // Component<any>
  getDefaultConfig: (params?: {
    stimulusId?: number
    groupId?: number
  }) => Partial<GridItemMap[K]>
  getDefaultHeight: (stimulusId?: number) => number
  getDefaultWidth: (stimulusId?: number) => number
}

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
  type: 'scarf' | 'transitionMatrix' | 'barPlot' | 'aoiStreamPlot'
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
   * @deprecated Use `timelineStart` and `timelineEnd` instead.
   */
  absoluteStimuliLimits: [number, number][]
  /**
   * Stimulus-specific ranges for ordinal timeline in [start, end] format.
   * For start (index 0): 0 means start at the beginning of the timeline.
   * For end (index 1): 0 means automatically use the full data range.
   * @deprecated Use `ordinalStart` and `ordinalEnd` instead.
   */
  ordinalStimuliLimits: [number, number][]
  /** Whether to use dynamic AOI (Area of Interest) calculations */
  dynamicAOI: boolean
  /** Array of segment type identifiers that are currently highlighted */
  highlights?: string[]
  /** Global timeline start (0 = beginning of timeline) */
  timelineStart?: number
  /** Global timeline end (0 = automatic) */
  timelineEnd?: number
  /** Global ordinal start (0 = beginning) */
  ordinalStart?: number
  /** Global ordinal end (0 = automatic) */
  ordinalEnd?: number
  /** Whether to hide non-fixation segments (saccades and others) */
  hideNonFixations?: boolean
}

/**
 * Interface representing a Transition Matrix grid item.
 * Extends the base GridType with Transition Matrix-specific properties.
 */
export interface TransitionMatrixGridType extends GridType {
  type: 'transitionMatrix'
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
  /** Method for ordering the bars */
  orderBy: 'value' | 'aoi'
  /** Direction of the ordering */
  orderDirection: 'asc' | 'desc'
  /** Method used for aggregating the data */
  aggregationMethod: string
  /**
   * Scale range in [start, end] format.
   * For start (index 0): The minimum value for the scale.
   * For end (index 1): The maximum value for the scale. 0 means automatically use the data range.
   */
  scaleRange: [number, number]
}

/**
 * Interface representing an Time-binned AOI Occupancy grid item.
 * Extends the base GridType with Time-binned AOI Occupancy-specific properties.
 */
export interface AoiStreamPlotGridType extends GridType {
  type: 'aoiStreamPlot'
  /** ID of the stimulus being visualized */
  stimulusId: number
  /** ID of the group rendered in the stream */
  groupId: number
  /** Duration of each time bin in milliseconds */
  binSize: number
  /** Array of AOI IDs to highlight (string format for consistency) */
  highlights?: string[]
  /**
   * Stimulus-specific ranges for absolute timeline in [start, end] format.
   * For start (index 0): 0 means start at the beginning of the timeline.
   * For end (index 1): 0 means automatically use the full data range.
   */
  absoluteStimuliLimits: [number, number][]
  /** Stream graph alignment mode */
  alignment?: 'stream' | 'distribution' | 'ridgeline' | 'heatmap'
  /** Custom color scale for heatmap mode (min, [middle], max) */
  colorScale?: string[]
  /** Vertical scaling factor for ridgeline mode (1.0 to 10.0, default 2.5) */
  ridgelineScale?: number
  /** Global timeline start (0 = beginning of timeline) */
  timelineStart?: number
  /** Global timeline end (0 = automatic) */
  timelineEnd?: number
}

/**
 * Core Identity Map - ties string literal types to their corresponding interfaces.
 * This is the "Golden Thread" that allows TypeScript to automate everything else.
 */
export type GridItemMap = {
  scarf: ScarfGridType
  transitionMatrix: TransitionMatrixGridType
  barPlot: BarPlotGridType
  aoiStreamPlot: AoiStreamPlotGridType
}

/**
 * Union type representing all possible grid item types in the workspace.
 * Now derived from GridItemMap for automatic type safety.
 */
export type AllGridTypes = GridItemMap[keyof GridItemMap]
