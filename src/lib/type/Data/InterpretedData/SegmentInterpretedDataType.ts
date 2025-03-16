import type { ExtendedInterpretedDataType } from './ExtendedInterpretedDataType'

export interface SegmentInterpretedDataType {
  id: number
  start: number
  end: number
  category: ExtendedInterpretedDataType
  aoi: ExtendedInterpretedDataType[]
}
