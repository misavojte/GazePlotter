/**
 * An object that represents the visibility blocks for AOIs.
 *
 * The object has string keys in the form of AAAxBBBxCCC, where AAA is the stimulusId, BBB is the aoiId,
 * and CCC is the participantId.
 *
 * The associated value is an array of numbers representing the visibility blocks for the AOI.
 * Each pair of consecutive numbers in the array represents the start and end values of a visibility block for the AOI.
 * The length of the array must be even, and each pair of consecutive numbers must represent a valid visibility block for the AOI.
 *
 * @example
 * const myAoiVisibility: AoiVisibility = {
 *   '001_002_003': [0, 100, 104, 120],
 *   '004_005_006': [10, 20, 30, 40, 50, 60],
 * };
 */
export interface VisibilityAoiDataType {
  [key: string]: number[]
}

export interface AoiDataType {
  data: string[][][]
  orderVector: number[][] | []
  dynamicVisibility: VisibilityAoiDataType
}
