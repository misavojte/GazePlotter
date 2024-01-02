import type { ExtendedInterpretedDataType } from './ExtendedInterpretedDataType.ts'

export interface SegmentInterpretedDataType {
  id: number
  start: number
  end: number
  category: ExtendedInterpretedDataType
  aoi: ExtendedInterpretedDataType[]
}
