import type { FileInputType, FileMetadataType } from './ingest/types'
import type { GridItemSnapshot } from '$lib/workspace/grid/types'
import type { BinarySegmentBuffers } from './binary'
import { FIXATION_CATEGORY_ID, FIXATION_SEED_NAME } from './binary'
import type { MetricInstance } from '$lib/metrics/instances'
import type { PairingErrorKind } from './intervalPairing'
export type { MetricInstance } from '$lib/metrics/instances'

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

/**
 * One optional reference medium per stimulus — an image OR a video. This is
 * metadata only; the bytes live as a Blob in the non-reactive
 * `stimulusMediaStore` (never base64 — recordings can be GBs) and persist as
 * a `media/<stimulusId>.<ext>` entry of the `.gazeplotter.zip` workspace
 * archive. Invariant: a `stimuliMedia[id]` entry exists iff the store holds
 * its blob.
 */
export interface StimulusMedia {
  kind: 'image' | 'video'
  mimeType: string
  /** Original upload name, for the UI readout and the zip entry extension. */
  fileName: string
  /** Intrinsic pixel size — defines the gaze coordinate space plots map onto. */
  naturalWidth: number
  naturalHeight: number
  /**
   * The rectangle in GAZE coordinates the media covers — user-editable so
   * gaze data plots over the image correctly when recording coordinates
   * don't align with image pixels. Absent = the media's own pixel space
   * (0, 0, naturalWidth, naturalHeight).
   */
  region?: { x: number; y: number; width: number; height: number }
}

export interface SegmentInterpretedDataType {
  id: number
  start: number
  end: number
  category: ExtendedInterpretedDataType
  aoi: ExtendedInterpretedDataType[]
}

/**
 * Per-stimulus replacement payload for the event store — the shape
 * `DataEngine.updateEventDataBatch` consumes and `updateEventData` commands
 * carry. Builders (channel deletion, interval derivation) emit it directly.
 */
export interface EventDataUpdate {
  stimulusId: number
  channelDefs: string[][]
  eventBuffers: number[][][]
  /** Display order for the NEW defs (omit for identity). Inverse commands
      carry it so undo restores a custom channel order. */
  orderVector?: number[]
}

interface AttributeDataType {
  /** Nested array mapping: [itemIndex][fieldIndex] where fieldIndex: 0=originalName, 1=displayedName, 2=color (optional) */
  data: string[][]
  orderVector: number[]
}

/** Label of the implicit default selection covering everything. */
export const ALL_SELECTION_LABEL = 'All'

/**
 * The reserved displayed name of the fixation baseline: id 0's row is the
 * substrate every AOI metric and the scarf's AOI layer scan, so its name is
 * a locked identity anchor. The single derivation behind all three guard
 * layers — the modal lock, the `updateCategories` write guard, and the
 * workspace-load heal — which refuse or repair any other row taking it.
 */
export function reservedFixationName(
  catData: readonly (readonly string[] | null)[] | undefined
): string {
  const row = catData?.[FIXATION_CATEGORY_ID]
  return ((row?.[1] ?? row?.[0]) ?? FIXATION_SEED_NAME).trim()
}

/** Id-keyed saved selection for axes with numeric member ids
    (stimuli, eye-movement categories). */
export interface EntitySelection {
  id: number
  name: string
  memberIds: number[]
}

/**
 * Name-keyed saved selection for per-stimulus axes whose members are portable
 * displayed names — event channels AND AOIs. The
 * SELECTION primitive answers "which members does this view range over"; MERGE
 * (displayed-name identity) is the other primitive — deliberately no "group"
 * terminology. Keyed BY DISPLAYED NAME (not raw ids): those ids are
 * per-stimulus, so a name set (`["face","text"]`) is portable across stimuli
 * and composes with the displayed-name merge/fold. A plot referencing an AOI
 * selection (settings.aoiSelectionId) shows only these members; the rest
 * collapse to no-AOI (compute-honest). Selection edits are pure metadata — they
 * MUST NOT feed `AoiGroupReader.groupPool` nor bump its structural version, or
 * every edit would blow the metric result cache.
 */
export interface NameSelection {
  id: number
  name: string
  /** Displayed names of the members (resolved per stimulus, post-merge). */
  names: string[]
}

export interface ParticipantsSelection {
  id: number
  name: string
  participantsIds: number[]
}

/**
 * The two "layer off" narrowings are ORDINARY rows, not a sentinel id, so a
 * selection id either names a stored row or means "All" (unset / 0 / unknown).
 * Seeded once per workspace (ingest kernel for a fresh dataset, the v5 → v6
 * migration for an older file); after that they are user data, so renaming or
 * deleting one sticks. (Participants' -1/-2 are a different id space.)
 */
export const seededCategoriesSelection = (id: number): EntitySelection => ({
  id,
  name: 'Just fixations',
  memberIds: [FIXATION_CATEGORY_ID],
})

/** Named for what it holds, so it reads the same in the picker and as a
    library chip — where a row called "None" would not. */
export const seededEventsSelection = (id: number): NameSelection => ({
  id,
  name: 'No events',
  names: [],
})

/**
 * All event data for the workspace.
 * Mirrors AoiDataType structure: per-stimulus channel definitions,
 * ordering, grouping (by displayedName), and per-channel event buffers.
 */
interface EventDataType {
  /**
   * Per-stimulus channel definitions.
   * [stimulusId][channelId][fieldIndex]
   * Fields: 0=originalName, 1=displayedName, 2=color,
   * 3=optional INTERVAL_CHANNEL_MARKER on derived interval channels.
   *
   * Same shape as AoiDataType.data. displayedName drives grouping.
   */
  data: string[][][]

  /** Per-stimulus display order of channels. */
  orderVector: number[][]

  /**
   * Per-stimulus per-channel per-participant event buffers.
   * [stimulusId][channelId][participantId] → stride-2 number[]
   * Layout: [start₀, duration₀, start₁, duration₁, ...] in ms.
   * Duration = 0 for discrete/instant events.
   */
  events: number[][][][]
}

interface AoiDataType {
  /** Nested array mapping: [stimulusIndex][aoiIndex][fieldIndex] where fieldIndex: 0=originalName, 1=displayedName, 2=color (optional) */
  data: string[][][]
  orderVector: number[][]
  /** Named, reusable AOI SELECTIONS (per-plot; name-keyed {@link NameSelection}). Absent = none. */
  selections?: NameSelection[]
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
type DataCapabilityKey = keyof DataCapabilities

/**
 * A single capability requirement item.
 *
 * - `"segmented"` means the capability is required directly.
 * - `["spatial", "event"]` means either capability is enough for that item.
 */
type DataCapabilityRequirement = DataCapabilityKey | DataCapabilityKey[]

/**
 * Capability requirements are evaluated as AND across the list.
 */
export type DataCapabilityRequirements = DataCapabilityRequirement[]

/** One malformed marker occurrence behind a data exclusion. */
export interface DatasetExclusionIssue {
  kind: PairingErrorKind
  /** When the offending marker occurred, in seconds of recording time. */
  timeSeconds: number
}

/**
 * A (stimulus, participant) group dropped during import because its source
 * data was judged scientifically invalid — currently interval-stimulus markers
 * that don't pair by strict alternation (a start while one is open, an end with
 * none open, or a start that never ends). Persisted with the dataset so the
 * reason survives workspace save/load and can be reviewed in the metadata view.
 */
export interface DatasetExclusionNotice {
  stimulus: string
  participant: string
  issues: DatasetExclusionIssue[]
}

/**
 * One entity folded into a representative by a merge (see PLANMERGE.md). A merge
 * is a lossless, disjoint fold — no segment data is dropped or shifted — so this
 * record alone reconstructs the member exactly on un-merge; it stores ids,
 * names, and positions, never segment data. The merge feature keeps every op
 * lossless precisely so the pre-merge original is always reconstructable and
 * exportable from the (kept) merge log.
 */
export interface MergeMember {
  /** The member's id on its axis. Tombstoned (kept in `data`), never reindexed. */
  id: number
  /** Its pre-merge displayed name — for the audit trail / export readout. */
  displayedName: string
  /** Its pre-merge position in the axis `orderVector`, for exact re-insertion. */
  orderIndex: number
  /**
   * The counterpart-axis ids whose cell the representative absorbed from this
   * member — stimulus ids for a participant merge, participant ids for a
   * stimulus merge. Disjoint by construction, so un-merge moves exactly these
   * cells back to the member.
   */
  contributedCounterparts: number[]
  /**
   * Participant axis only: per `(stimulus, channel)` event-occurrence cell the
   * representative absorbed from this member, with `boundary` = the number of
   * flat buffer elements the representative held before the member's were
   * appended (0 in the clean disjoint case). Un-merge splits the representative
   * buffer at `boundary` to restore the member's occurrences exactly.
   */
  eventContributions?: { stimulus: number; channel: number; boundary: number }[]
  /**
   * Stimulus axis only (M4): the member stimulus's per-stimulus AOI /
   * event-channel dictionary reconciliation into the representative's id space,
   * so un-merge restores the member's own id space. Absent for participant
   * merges (AOIs/channels are stimulus-scoped, untouched).
   */
  aoiDictRemap?: MergeDictRemap
  channelDictRemap?: MergeDictRemap
  /**
   * Stimulus axis only (M4): per `(member-local channel, participant)` event
   * cell the representative absorbed, with `boundary` = the representative
   * buffer's prior length. Un-merge splits it back exactly. The representative
   * channel is `channelDictRemap.remap[memberChannel]`.
   */
  stimulusEventContributions?: {
    memberChannel: number
    participant: number
    boundary: number
  }[]
}

/**
 * Stimulus-axis dictionary reconciliation record (M4). When stimulus `M` folds
 * into representative `R`, `M`'s per-stimulus AOI (or event-channel) dictionary
 * is unified into `R`'s by displayed name: same-named entries map to `R`'s id,
 * `M`-only entries append to `R`. This records the exact inverse.
 */
interface MergeDictRemap {
  /** Member-local id -> merged (rep-space) id; total and dense over member ids. */
  remap: number[]
  /** `R`'s dictionary length before this member folded — un-merge shrinks back to it. */
  repCountBefore: number
}

/**
 * Append-only record of one merge (or its reversal). Persisted with the dataset
 * (mirrors {@link DatasetExclusionNotice}); it is the durable record of prior
 * state AND the inverse used to reconstruct the original. Never rewritten in
 * place — an un-merge appends an `op: 'unmerge'` entry rather than deleting.
 */
export interface MergeLogEntry {
  op: 'merge' | 'unmerge'
  axis: 'stimulus' | 'participant'
  /** The surviving representative entity's id. */
  representativeId: number
  members: MergeMember[]
  /**
   * Participant axis only: named participant selections that CHANGED (a member
   * substituted by the representative), snapshotted pre-fold so un-merge
   * restores them exactly. Selections are tiny id-lists, so snapshotting the
   * changed ones is the simplest exact inverse. Absent when none changed.
   */
  participantsSelectionsBefore?: { id: number; participantsIds: number[] }[]
  /** Epoch ms when the operation happened, for the audit trail. */
  at: number
}

/**
 * Data for workspace are stored in this unique format.
 */
export interface DataType {
  isOrdinalOnly: boolean
  capabilities: DataCapabilities
  aois: AoiDataType
  categories: AttributeDataType
  participants: AttributeDataType
  participantsSelections: ParticipantsSelection[]
  /** Saved stimulus selections (absent in older workspaces). */
  stimuliSelections?: EntitySelection[]
  /** Saved eye-movement-category selections (absent in older workspaces). */
  categoriesSelections?: EntitySelection[]
  /** Saved event-channel selections, name-keyed (absent in older workspaces). */
  eventsSelections?: NameSelection[]
  metricInstances: MetricInstance[]
  stimuli: AttributeDataType
  segments: BinarySegmentBuffers
  noAoiTreatment: NoAoiTreatmentType
  eventData: EventDataType
  /** Groups dropped at import time, with why. Absent when nothing was dropped. */
  dataExclusions?: DatasetExclusionNotice[]
  /**
   * Append-only log of entity merges (see PLANMERGE.md). Absent when nothing was
   * merged. The durable record of prior state + the inverse for un-merge.
   */
  merges?: MergeLogEntry[]
  /**
   * Per-stimulus reference media, keyed by stable stimulus id (ids are
   * tombstoned, never reindexed — see {@link MergeMember}). Absent when no
   * stimulus has media. Metadata only; see {@link StimulusMedia}.
   */
  stimuliMedia?: Record<number, StimulusMedia>
}

/**
 * Reactive slice of {@link EventDataType}: channel definitions and display
 * order — the small, UI-edited metadata that stays inside
 * Svelte runes. The heavy per-occurrence buffers (`events`) are NOT here;
 * the data engine holds them in a non-reactive binary `EventBufferReader`,
 * mirroring how `segments` stay out of runes.
 */
export type EventChannelMeta = Omit<EventDataType, 'events'>

/**
 * The data engine's reactive metadata: the full workspace dataset minus the
 * two binary stores it owns outside runes — `segments` (occurrence-free
 * segment buffers) and the event occurrence buffers (so `eventData` is
 * narrowed to {@link EventChannelMeta}).
 */
export type EngineMetadata = Omit<DataType, 'segments' | 'eventData'> & {
  eventData: EventChannelMeta
}

/**
 * Type for legacy JSON import/export format with nested array segments.
 */
export type JsonImportOldFormat = Omit<DataType, 'segments'> & {
  segments: number[][][][]
  spatialData?: (number[] | null)[][][]
}

/**
 * Current workspace-schema version. `main` ships v5 (1.9.2); the settings-key
 * rename `barPlottingType` → `orientation` and the seeded layer-off selections
 * are the single bump above it (v5 → v6). The retired `-1` sentinel gets no
 * version of its own: it is a legacy VALUE, swept wherever it appears, because
 * in-branch builds stamped 6 while it was still live. Both the export mapper
 * (the version it stamps) and the migration
 * ceiling (the version it produces) source this one constant, so a freshly
 * exported file always carries the version of the data inside it — no
 * re-import migration is relied upon to reconcile a mislabel.
 *
 * Keep this comment's "`main` ships vN" claim checked against `main` when
 * bumping: it went stale once already (it still said v4 after v5 shipped),
 * which would have sent a released format down an unreachable migration path.
 */
export const CURRENT_SCHEMA_VERSION = 6

export interface JsonImportNewFormat {
  version: 2 | 3 | 4 | 5 | 6
  data: DataType
  gridItems?: GridItemSnapshot[]
  fileMetadata?: FileMetadataType | null
}

interface RawEventDataType {
  data?: string[][][]
  orderVector?: number[][]
  events?: number[][][][]
}

export interface RawIngestPayload {
  isOrdinalOnly?: boolean
  capabilities?: Partial<DataCapabilities>
  aois: {
    data: string[][][]
    orderVector?: number[][]
    dynamicVisibility?: Record<string, unknown>
  }
  categories?: AttributeDataType
  participants: AttributeDataType
  participantsSelections?: ParticipantsSelection[]
  stimuliSelections?: EntitySelection[]
  categoriesSelections?: EntitySelection[]
  eventsSelections?: NameSelection[]
  metricInstances?: MetricInstance[]
  stimuli: AttributeDataType
  segments?: unknown
  noAoiTreatment?: NoAoiTreatmentType
  eventData?: RawEventDataType
  spatialData?: unknown
  dataExclusions?: DatasetExclusionNotice[]
  merges?: MergeLogEntry[]
  stimuliMedia?: Record<number, StimulusMedia>
}

export interface MigratedJsonFormat {
  version: number
  data: RawIngestPayload
  gridItems?: unknown[]
  fileMetadata?: unknown
}

export type ParsedData = JsonImportNewFormat & {
  current: FileInputType
  /** True for freshly parsed datasets (not restored workspaces) —
      gates post-upload notices like the imported-events toast. */
  freshDataset?: boolean
  /** Stimulus reference media bytes from a workspace archive, keyed by
      stimulus id (see {@link StimulusMedia}). */
  mediaBlobs?: Record<number, Blob>
}

// Binary relational memory model
export * from './binary'
