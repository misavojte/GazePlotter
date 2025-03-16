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
  absoluteGeneralLastVal: number
  absoluteStimuliLastVal: number[]
  ordinalGeneralLastVal: number
  ordinalStimuliLastVal: number[]
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
