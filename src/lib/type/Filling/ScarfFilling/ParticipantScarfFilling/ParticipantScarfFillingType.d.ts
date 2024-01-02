import type { SegmentScarfFillingType } from '../SegmentScarfFilling/SegmentScarfFillingType.ts';
import type { AoiVisibilityScarfFillingType } from '../AoiVisibilityScarfFilling/AoiVisibilityScarfFillingType.ts';
export interface ParticipantScarfFillingType {
    id: number;
    label: string;
    width: string;
    segments: SegmentScarfFillingType[];
    dynamicAoiVisibility: AoiVisibilityScarfFillingType[];
}
