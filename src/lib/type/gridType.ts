export interface GridType {
  id: number
  x: number
  y: number
  w: number
  h: number
  min: { w: number; h: number }
  type: 'scarf' | 'AoiTransitionMatrix'
}

export interface ScarfGridType extends GridType {
  type: 'scarf'
  stimulusId: number
  groupId: number
  zoomLevel: number
  timeline: 'absolute' | 'relative' | 'ordinal'
  /**
   * General range for absolute timeline in [start, end] format.
   * For start (index 0): 0 means start at the beginning of the timeline.
   * For end (index 1): 0 means automatically use the full data range.
   */
  absoluteGeneralLimits: [number, number]
  /**
   * Stimulus-specific ranges for absolute timeline in [start, end] format.
   * For start (index 0): 0 means start at the beginning of the timeline.
   * For end (index 1): 0 means automatically use the full data range.
   */
  absoluteStimuliLimits: [number, number][]
  /**
   * General range for ordinal timeline in [start, end] format.
   * For start (index 0): 0 means start at the beginning of the timeline.
   * For end (index 1): 0 means automatically use the full data range.
   */
  ordinalGeneralLimits: [number, number]
  /**
   * Stimulus-specific ranges for ordinal timeline in [start, end] format.
   * For start (index 0): 0 means start at the beginning of the timeline.
   * For end (index 1): 0 means automatically use the full data range.
   */
  ordinalStimuliLimits: [number, number][]
  dynamicAOI: boolean
}

export interface AoiTransitionMatrixGridType extends GridType {
  type: 'AoiTransitionMatrix'
  stimulusId: number
  groupId: number
  maxColorValue: number // 0 means auto-calculate from data
  aggregationMethod: string // Store the aggregation method in settings
}

// now create a type that is a union of all the grid types
export type AllGridTypes = ScarfGridType | AoiTransitionMatrixGridType
