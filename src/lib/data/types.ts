import type { FileInputType, FileMetadataType } from '$lib/data/ingest'
import type { GridItemSnapshot } from '$lib/workspace'
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
  /** Nested array mapping: [itemIndex][fieldIndex] where fieldIndex: 0=originalName, 1=displayedName, 2=color (optional) */
  data: string[][]
  orderVector: number[]
}

export interface ParticipantsGroup {
  id: number
  name: string
  participantsIds: number[]
}

/**
 * All event data for the workspace.
 * Mirrors AoiDataType structure: per-stimulus channel definitions,
 * ordering, hiding, grouping (by displayedName), and per-channel event buffers.
 */
export interface EventDataType {
  /**
   * Per-stimulus channel definitions.
   * [stimulusId][channelId][fieldIndex]
   * Fields: 0=originalName, 1=displayedName, 2=color
   *
   * Same shape as AoiDataType.data. displayedName drives grouping.
   */
  data: string[][][]

  /** Per-stimulus display order of channels. */
  orderVector: number[][]

  /** Per-stimulus hidden channel IDs. */
  hiddenChannels: number[][]

  /**
   * Per-stimulus per-channel per-participant event buffers.
   * [stimulusId][channelId][participantId] → stride-2 number[]
   * Layout: [start₀, duration₀, start₁, duration₁, ...] in ms.
   * Duration = 0 for discrete/instant events.
   */
  events: number[][][][]
}

export interface AoiDataType {
  /** Nested array mapping: [stimulusIndex][aoiIndex][fieldIndex] where fieldIndex: 0=originalName, 1=displayedName, 2=color (optional) */
  data: string[][][]
  orderVector: number[][]
  /** Per-stimulus list of raw AOI ids that should be treated as nonexistent in visualizations. */
  hiddenAois: number[][]
}

/**
 * Canonical dataset-level capabilities used for feature gating.
 */
export interface DataCapabilities {
  /** True when the dataset contains at least one segment row. */
  segmented: boolean
  /** True when at least one segment has valid spatial coordinates (x, y). */
  spatial: boolean
  /** True when at least one event channel has at least one event buffer entry. */
  event: boolean
}

/**
 * Declarative capability keys used by plot/view availability requirements.
 */
export type DataCapabilityKey = keyof DataCapabilities

/**
 * A single capability requirement item.
 *
 * - `"segmented"` means the capability is required directly.
 * - `["spatial", "event"]` means either capability is enough for that item.
 */
export type DataCapabilityRequirement = DataCapabilityKey | DataCapabilityKey[]

/**
 * Capability requirements are evaluated as AND across the list.
 */
export type DataCapabilityRequirements = DataCapabilityRequirement[]

/**
 * Data for workspace are stored in this unique format.
 */
export interface DataType {
  isOrdinalOnly: boolean
  capabilities: DataCapabilities
  aois: AoiDataType
  categories: AttributeDataType
  participants: AttributeDataType
  participantsGroups: ParticipantsGroup[]
  metricInstances: MetricInstance[]
  stimuli: AttributeDataType
  segments: BinarySegmentBuffers
  noAoiTreatment: NoAoiTreatmentType
  eventData: EventDataType
}

export interface MetricInstance {
  id: number
  baseId: string
  params: Record<string, unknown>
  label: string
  system?: true
}

/**
 * Type for legacy JSON import/export format with nested array segments.
 */
export type JsonImportOldFormat = Omit<DataType, 'segments'> & {
  segments: number[][][][]
  spatialData?: (number[] | null)[][][]
}

export interface JsonImportNewFormat {
  version: 2 | 3 | 4 | 5
  data: DataType
  gridItems?: GridItemSnapshot[]
  fileMetadata?: FileMetadataType | null
}

export type ParsedData = JsonImportNewFormat & { current: FileInputType }

// Binary relational memory model
export * from './binary'
