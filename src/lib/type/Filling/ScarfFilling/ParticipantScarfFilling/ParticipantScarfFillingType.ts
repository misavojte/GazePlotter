import type { SegmentScarfFillingType } from '../SegmentScarfFilling/SegmentScarfFillingType'
import type { AoiVisibilityScarfFillingType } from '../AoiVisibilityScarfFilling/AoiVisibilityScarfFillingType'

export interface ParticipantScarfFillingType {
  id: number
  label: string
  width: string // in %!
  segments: SegmentScarfFillingType[]
  dynamicAoiVisibility: AoiVisibilityScarfFillingType[]
}
