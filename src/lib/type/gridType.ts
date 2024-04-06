export interface GridType {
  id: number
  x: number
  y: number
  w: number
  h: number
  min: { w: number; h: number }
  type: 'scarf' | 'empty' | 'load'
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

export interface EmptyGridType extends GridType {
  type: 'empty'
}

export interface LoadGridType extends GridType {
  type: 'load'
}

// now create a type that is a union of all the grid types
export type AllGridTypes = ScarfGridType | EmptyGridType | LoadGridType
