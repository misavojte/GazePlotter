import type { VisibilityAoiDataType } from './VisibilityAoiDataType/VisibilityAoiDataType'

export interface AoiDataType {
  data: string[][][]
  orderVector: number[][] | []
  dynamicVisibility: VisibilityAoiDataType
}
