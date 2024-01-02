import type { VisibilityAoiDataType } from './VisibilityAoiDataType/VisibilityAoiDataType.ts';
export interface AoiDataType {
    data: string[][][];
    orderVector: number[][] | [];
    dynamicVisibility: VisibilityAoiDataType;
}
