import type { SegmentScarfFillingType } from '../SegmentScarfFilling/SegmentScarfFillingType'
import type { AoiVisibilityScarfFillingType } from '../AoiVisibilityScarfFilling/AoiVisibilityScarfFillingType'

export interface ParticipantScarfFillingType {
  id: number
  label: string
  width: number // decimal 0-1 (instead of percentage string)
  segments: SegmentScarfFillingType[]
  dynamicAoiVisibility: AoiVisibilityScarfFillingType[]
}
