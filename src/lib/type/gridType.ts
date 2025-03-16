export interface GridType {
  id: number
  x: number
  y: number
  w: number
  h: number
  min: { w: number; h: number }
  type: 'scarf' | 'aoiTransitionMatrix'
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

export interface AOITransitionMatrixGridType extends GridType {
  type: 'aoiTransitionMatrix'
  stimulusId: number
  groupId: number
}

// now create a type that is a union of all the grid types
export type AllGridTypes = ScarfGridType | AOITransitionMatrixGridType
