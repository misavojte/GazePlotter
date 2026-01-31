import type {
  FileInputType,
  FileMetadataType,
} from '$lib/workspace/type/fileMetadataType'
import type { AllGridTypes } from '$lib/workspace/type/gridType'
import type { BinarySegmentBuffers } from './binary'

import { DEFAULT_NO_AOI_COLOR } from '../color/palettes'

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
  color: DEFAULT_NO_AOI_COLOR,
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
  orderVector: number[]
}

export interface ParticipantsGroup {
  id: number
  name: string
  participantsIds: number[]
}

/**
 * An object that represents the visibility blocks for AOIs.
 */
export interface VisibilityAoiDataType {
  [key: string]: number[]
}

export interface AoiDataType {
  data: string[][][]
  orderVector: number[][]
  dynamicVisibility: VisibilityAoiDataType
  /** Per-stimulus list of raw AOI ids that should be treated as nonexistent in visualizations. */
  hiddenAois: number[][]
}

/**
 * Data for workplace are stored in this unique format.
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
export * from './binary'
