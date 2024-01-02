import type { AoiDataType } from './AoiDataType/AoiDataType.ts';
import type { AttributeDataType } from './AttributeDataType/AttributeDataType.ts';
/**
 * Data for workplace are stored in this unique format.
 *
 * It has complicated structure, but it is more performant
 * than using, e.g., IndexedDB (up to 10x faster in Safari with 50k+ segments).
 *
 * This allows quick write and read operations as everything is stored in memory.
 *
 * @property {boolean} isOrdinalOnly - Whether the const contains only ordinal const.
 */
export interface DataType {
    isOrdinalOnly: boolean;
    aois: AoiDataType;
    categories: AttributeDataType;
    participants: AttributeDataType;
    stimuli: AttributeDataType;
    segments: number[][][][];
}
