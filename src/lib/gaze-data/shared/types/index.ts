import type {
  FileInputType,
  FileMetadataType,
} from '$lib/workspace/type/fileMetadataType'
import type { AllGridTypes } from '$lib/workspace/type/gridType'
import type { BinarySegmentBuffers } from './binaryDataTypes'

/**
 * Used for stimuli and participants basic information.
 */
export interface BaseInterpretedDataType {
  id: number
  originalName: string
  displayedName: string
}

/**
 * Used for AOI and category basic information.
 */
export interface ExtendedInterpretedDataType extends BaseInterpretedDataType {
  color: string
}

/**
 * Used for No AOI hit treatment configuration.
 */
export interface NoAoiTreatmentType {
  displayedName: string
  color: string
}

/**
 * Default values for No AOI treatment.
 */
export const DEFAULT_NO_AOI_TREATMENT: NoAoiTreatmentType = {
  displayedName: 'No AOI',
  color: '#c0c0c0',
}

export interface SegmentInterpretedDataType {
  id: number
  start: number
  end: number
  category: ExtendedInterpretedDataType
  aoi: ExtendedInterpretedDataType[]
}

export interface AttributeDataType {
  data: string[][]
  orderVector: number[] | []
}

export interface ParticipantsGroup {
  id: number
  name: string
  participantsIds: number[]
}

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
  /** Per-stimulus list of raw AOI ids that should be treated as nonexistent in visualizations. */
  hiddenAois: number[][]
}

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
  isOrdinalOnly: boolean
  aois: AoiDataType
  categories: AttributeDataType
  participants: AttributeDataType
  participantsGroups: ParticipantsGroup[]
  stimuli: AttributeDataType
  segments: BinarySegmentBuffers
  noAoiTreatment: NoAoiTreatmentType
}

/**
 * Type for legacy JSON import/export format with nested array segments.
 * Used only at the boundaries (import/export), never for internal processing.
 */
export type JsonImportOldFormat = Omit<DataType, 'segments'> & {
  segments: number[][][][]
}

export type JsonImportNewFormat =
  | {
      version: 2
      data: DataType
      gridItems: Array<Partial<AllGridTypes> & { type: string }>
    }
  | {
      version: 3
      fileMetadata: FileMetadataType
      data: DataType
      gridItems: Array<Partial<AllGridTypes> & { type: string }>
    }

export type ParsedData = JsonImportNewFormat & { current: FileInputType }

// Binary relational memory model
export * from './binaryDataTypes'
export * from './binaryConverters'
