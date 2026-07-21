import type {
  ExtendedInterpretedDataType,
  BaseInterpretedDataType,
  ParticipantsSelection,
  EntitySelection,
  NameSelection,
  MergeLogEntry,
} from '$lib/data/types'
import type { MetricInstance } from '$lib/metrics'
import type {
  AllPlotSettings,
  GridItemLayoutUpdate,
  GridItemSnapshot,
} from '$lib/workspace'

/**
 * Workspace Command System
 *
 * Centralized command types for all workspace changes.
 * All data and settings modifications go through these commands
 * to ensure proper tracking and automatic redraw propagation.
 *
 * Simplified structure without nested payload - TypeScript ensures type safety
 * through discriminated unions based on the 'type' field.
 */

interface BaseCommandInterface {
  type: string
  source: string // this has specific pattern! 'scarfPlot.IDOFPLOT.PLACEOFTRIGGER' and for undo the same 'undo.scarfPlot.IDOFPLOT.PLACEOFTRIGGER'
}

// Data change commands
export interface UpdateAoisCommand extends BaseCommandInterface {
  type: 'updateAois'
  aois: ExtendedInterpretedDataType[]
  stimulusId: number
  applyTo: 'this_stimulus' | 'all_by_original_name' | 'all_by_displayed_name'
}

// Rename + reorder one entity axis. Stimuli and participants are the same
// `[originalName, displayedName]`-row table, so ONE axis-tagged command serves
// both (the axis is also how the merge log is keyed — see MergeLogEntry).
export interface UpdateEntitiesCommand extends BaseCommandInterface {
  type: 'updateEntities'
  axis: 'participant' | 'stimulus'
  items: BaseInterpretedDataType[]
}

export interface UpdateEventDataCommand extends BaseCommandInterface {
  type: 'updateEventData'
  stimulusId: number
  channelDefs: string[][]
  eventBuffers: number[][][]
  /** Display order for the NEW defs (omit for identity). Inverse commands
      carry it so undo restores a custom channel order. */
  orderVector?: number[]
}

export interface UpdateEventChannelsCommand extends BaseCommandInterface {
  type: 'updateEventChannels'
  stimulusId: number
  channels: ExtendedInterpretedDataType[]
}

export interface UpdateParticipantsSelectionsCommand extends BaseCommandInterface {
  type: 'updateParticipantsSelections'
  selections: ParticipantsSelection[]
}

export interface UpdateStimuliSelectionsCommand extends BaseCommandInterface {
  type: 'updateStimuliSelections'
  selections: EntitySelection[]
}

export interface UpdateCategoriesSelectionsCommand extends BaseCommandInterface {
  type: 'updateCategoriesSelections'
  selections: EntitySelection[]
}

export interface UpdateEventsSelectionsCommand extends BaseCommandInterface {
  type: 'updateEventsSelections'
  selections: NameSelection[]
}

export interface UpdateNoAoiTreatmentCommand extends BaseCommandInterface {
  type: 'updateNoAoiTreatment'
  noAoiTreatment: { displayedName: string; color: string }
}

// Merge commands (see PLANMERGE.md M3). A merge is a lossless, disjoint fold;
// the pair is symmetric so undo/redo just swap them. The reverse of a merge is
// an un-merge carrying the deterministically-precomputed log entry (the entry
// is a pure function of the pre-merge state, so it can be captured before the
// forward runs, satisfying the bus's reverse-before-execute contract).
// One axis-tagged pair for both axes (`axis` selects the participant vs stimulus
// fold — stimulus additionally reconciles the per-stimulus AOI/channel
// dictionaries, entirely below this command layer).
export interface MergeEntitiesCommand extends BaseCommandInterface {
  type: 'mergeEntities'
  axis: 'participant' | 'stimulus'
  representativeId: number
  memberIds: number[]
  /** Timestamp stamped into the log entry; carried so forward + reverse agree. */
  at: number
}

export interface UnmergeEntitiesCommand extends BaseCommandInterface {
  type: 'unmergeEntities'
  axis: 'participant' | 'stimulus'
  entry: MergeLogEntry
}

// Atomic merge reconciliation for the stimulus/participant modal (PLANMERGE.md
// M2 UX). One Apply, one undo step. The modal edits the FULL entity list
// (visible entities + the members currently merged into them) and derives the
// desired merge groups from the displayed-name grouping. This command replays
// that intent as ONE chain: unmerge everything active on the axis (restoring a
// clean, un-tombstoned order), commit the edited names + order, then merge the
// desired groups. Renaming a member apart drops it from `groups`, so it stays
// un-merged; renaming two together adds a group, so they merge. Because all
// work happens in child commands, the root's own reverse is a `noop` — the
// children's recorded reverses restore the pre-Apply state on undo.
export interface ReconcileMergesCommand extends BaseCommandInterface {
  type: 'reconcileMerges'
  axis: 'stimulus' | 'participant'
  /** Full entity list (visible + currently-merged members) with edited names/order. */
  items: BaseInterpretedDataType[]
  /** Desired merge groups after this Apply; `at` reuses an unchanged group's
      original timestamp (provenance) and is fresh for a newly-formed merge. */
  groups: { representativeId: number; memberIds: number[]; at: number }[]
}

// A command that does nothing. Used as the reverse of a pure orchestrator
// (reconcileMerges) whose every effect lives in child commands: the bus
// requires a non-null reverse, and the children's own reverses do the undo.
export interface NoopCommand extends BaseCommandInterface {
  type: 'noop'
}

export interface UpdateCategoriesCommand extends BaseCommandInterface {
  type: 'updateCategories'
  categories: ExtendedInterpretedDataType[]
}

// Named AOI SELECTIONS (see NameSelection / PLANAOISELECTION.md). Carries the
// FULL selections array — create/rename/delete/edit are one operation at
// different deltas, so one handler, one reverse (snapshot of the previous
// array), one undo step. Metadata-only; does not touch groupPool/version.
export interface UpdateAoiSelectionsCommand extends BaseCommandInterface {
  type: 'updateAoiSelections'
  selections: NameSelection[]
}

// Metric library command. Carries the FULL instances array — rename, create,
// delete, replace and reorder are all the same operation at different deltas,
// so they share one handler, one reverse (snapshot of the previous array) and
// one atomic undo step. All metric-library mutations go through this command;
// nothing edits `engine.metadata.metricInstances` directly.
export interface UpdateMetricInstancesCommand extends BaseCommandInterface {
  type: 'updateMetricInstances'
  instances: MetricInstance[]
}

// Settings change command.
// Operates on a *set* of items: a single edit is a list of one, a bulk edit
// is a list of N. There is no separate "bulk" command — single and bulk are
// the same operation at different cardinality, so they share one handler,
// one reverse, and one undo step.
export interface UpdateSettingsCommand extends BaseCommandInterface {
  type: 'updateSettings'
  updates: { itemId: number; settings: Partial<AllPlotSettings> }[]
}

// Layout change command. Like updateSettings, it targets a *set* of items:
// a single move/resize is a list of one; a group move is a list of N,
// committed and reversed as one atomic undo step.
export interface UpdateLayoutCommand extends BaseCommandInterface {
  type: 'updateLayout'
  updates: { itemId: number; layout: GridItemLayoutUpdate }[]
}

// Grid item management commands
export interface AddGridItemCommand extends BaseCommandInterface {
  type: 'addGridItem'
  vizType: string
  options?: GridItemSnapshot & { skipCollisionResolution?: boolean }
  itemId: number // Required itemId for command reversal
  /** Explicit grid-coord placement; omit to fall back to auto-placement. */
  position?: { x: number; y: number }
}

export interface RemoveGridItemCommand extends BaseCommandInterface {
  type: 'removeGridItem'
  itemId: number
}

export interface DuplicateGridItemCommand extends BaseCommandInterface {
  type: 'duplicateGridItem'
  itemId: number
  duplicateId: number
  /** Explicit grid-coord placement; omit to fall back to auto-placement. */
  position?: { x: number; y: number }
}

export interface SetLayoutStateCommand extends BaseCommandInterface {
  type: 'setLayoutState'
  layoutState: GridItemSnapshot[]
}

export type WorkspaceCommand =
  | UpdateAoisCommand
  | UpdateEntitiesCommand
  | UpdateEventDataCommand
  | UpdateEventChannelsCommand
  | UpdateParticipantsSelectionsCommand
  | UpdateStimuliSelectionsCommand
  | UpdateCategoriesSelectionsCommand
  | UpdateEventsSelectionsCommand
  | UpdateNoAoiTreatmentCommand
  | MergeEntitiesCommand
  | UnmergeEntitiesCommand
  | ReconcileMergesCommand
  | NoopCommand
  | UpdateCategoriesCommand
  | UpdateAoiSelectionsCommand
  | UpdateMetricInstancesCommand
  | UpdateSettingsCommand // includes position and size updates
  | UpdateLayoutCommand
  | AddGridItemCommand
  | RemoveGridItemCommand
  | DuplicateGridItemCommand
  | SetLayoutStateCommand

/**
 * WorkspaceCommandChain
 *
 * A workspace command with an associated chain identifier.
 * When a command triggers additional commands (e.g., collision resolution),
 * those generated commands share the same chainId to track the operation chain.
 *
 * This enables tracking causality: "which commands were triggered by which original action?"
 * Essential for logging, debugging, and future undo/redo functionality.
 */
export type WorkspaceCommandChain = WorkspaceCommand & {
  /** Unique identifier for the command chain. All related commands share the same chainId. */
  chainId: number
  isRootCommand: boolean
  history?: 'undo' | 'redo'
}
