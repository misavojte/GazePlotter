<script module lang="ts">
  import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
  import {
    getParticipantsSelections,
    getParticipantsWithMerged,
    getStimuliSelections,
    getStimuliWithMerged,
  } from '$lib/data/engine'
  import type {
    BaseInterpretedDataType,
    EntitySelection,
    ParticipantsSelection,
  } from '$lib/data/types'
  import type { StimulusMediaUpdate, WorkspaceCommand } from '$lib/workspace/commands'
  import type { MergeAxisMessages } from './mergeAxisEditor.svelte'
  import type { SelectionLike } from './selectionSession.svelte'
  import type { TableColumn } from './EditableEntityList.svelte'
  import { stimulusMediaModal } from '../stimulus-media/definition'
  import { deepEqual } from '$lib/plots/shared/plotData.svelte'

  /**
   * Everything axis-specific about one MERGE-axis modal (participants,
   * stimuli): the axis literal the workspace calls are keyed by, the engine
   * getters, where the id-keyed selection stores its member ids, and the
   * user-facing strings. The whole modal body below is shared.
   */
  export interface MergeAxisModalConfig<
    K extends string,
    TSel extends SelectionLike & Record<K, number[]>,
  > {
    axis: 'participant' | 'stimulus'
    /** Where the selection stores its member ids (see selectionAdapters). */
    field: K
    /** The axis' entities, merged members folded in under their survivor. */
    getItems: (engine: DataEngine) => BaseInterpretedDataType[]
    /** The axis' saved SELECTIONS. */
    getSelections: (engine: DataEngine) => TSel[]
    /**
     * The command that saves this axis' selections. Declared per axis because
     * `updateSelections` correlates the axis literal with the payload type, and
     * only here is `TSel` concrete — the shared body below cannot prove the
     * pairing across its generic, and asserting it there would need a cast.
     */
    selectionsCommand: (selections: TSel[], source: string) => WorkspaceCommand
    messages: MergeAxisMessages
    title: string
    emptyMessage: string
    /** Plural entity noun for the tray verbs and tooltips. */
    noun: string
    columns: TableColumn[]
    /** The stimulus axis' reference-media column (leader rows). Its button
        PUSHES the media modal so this modal (and its unsaved edits) stays alive
        underneath; the update it resolves with is held here, saved on Apply
        and dropped on Cancel. */
    rowAction?: { column: TableColumn }
  }

  export const PARTICIPANT_MERGE_AXIS: MergeAxisModalConfig<
    'participantsIds',
    ParticipantsSelection
  > = {
    axis: 'participant',
    field: 'participantsIds',
    getItems: getParticipantsWithMerged,
    getSelections: engine => getParticipantsSelections(engine),
    selectionsCommand: (selections, source) => ({
      type: 'updateSelections',
      axis: 'participant',
      selections,
      source,
    }),
    messages: {
      conflict: n =>
        `Can't merge: recordings overlap on ${n} ${n > 1 ? 'stimuli' : 'stimulus'}.`,
      merged:
        'Merged into one participant. Rename a row apart to restore the original.',
      willMerge:
        'Will merge into one participant on Apply. Recordings are combined and it stays reversible.',
    },
    title: 'Participants',
    emptyMessage: 'No participants found',
    noun: 'participants',
    columns: [
      { label: 'Move', width: '28px', type: 'handle' },
      {
        label: 'Original',
        width: '1fr',
        type: 'readonly',
        key: 'originalName',
        tooltip:
          'The participant name from the imported recording. It never changes.',
      },
      {
        label: 'Displayed',
        width: '1fr',
        type: 'text',
        key: 'displayedName',
        tooltip:
          'The name plots show. Giving two rows the same displayed name merges the participants (their recordings combine).',
      },
    ],
  }

  // Stimuli selections are consumed by the metric-matrix "Stimuli" section.
  export const STIMULUS_MERGE_AXIS: MergeAxisModalConfig<
    'memberIds',
    EntitySelection
  > = {
    axis: 'stimulus',
    field: 'memberIds',
    getItems: getStimuliWithMerged,
    getSelections: getStimuliSelections,
    selectionsCommand: (selections, source) => ({
      type: 'updateSelections',
      axis: 'stimulus',
      selections,
      source,
    }),
    messages: {
      conflict: n =>
        `Can't merge: ${n} participant${n > 1 ? 's have' : ' has'} recordings on more than one.`,
      merged:
        'Merged into one stimulus. Rename a row apart to restore the original.',
      willMerge:
        'Will merge into one stimulus on Apply. Recordings are combined and it stays reversible.',
    },
    title: 'Stimuli',
    emptyMessage: 'No stimuli found',
    noun: 'stimuli',
    rowAction: {
      column: {
        label: 'Media',
        width: '44px',
        align: 'center',
        type: 'action',
        icon: 'image',
        tooltip:
          'Reference image/video drawn behind gaze data (scanpath background). Filled = attached; click to add, position, or remove it.',
      },
    },
    columns: [
      { label: 'Move', width: '28px', type: 'handle' },
      {
        label: 'Original',
        width: '1fr',
        type: 'readonly',
        key: 'originalName',
        tooltip:
          'The stimulus name from the imported recording. It never changes.',
      },
      {
        label: 'Displayed',
        width: '1fr',
        type: 'text',
        key: 'displayedName',
        tooltip:
          'The name plots show. Giving two rows the same displayed name merges the stimuli (their recordings combine).',
      },
    ],
  }
</script>

<script
  lang="ts"
  generics="K extends string, TSel extends SelectionLike & Record<K, number[]>"
>
  import { Section, ModalButtons } from '$lib/modals'
  import { getGazePlotterSession } from '$lib/session'
  import EditableEntityList from './EditableEntityList.svelte'
  import SelectionTray from './SelectionTray.svelte'
  import { createMergeAxisEditor } from './mergeAxisEditor.svelte'
  import { createSelectionSession } from './selectionSession.svelte'
  import {
    idKeyedSelection,
    referencedSelectionIds,
    selectionChips,
  } from './selectionAdapters'

  interface Props {
    config: MergeAxisModalConfig<K, TSel>
    source: string
  }

  let { config, source }: Props = $props()
  const { engine, grid, modalState, workspace, toastState } = getGazePlotterSession()

  // `config` is a frozen module constant picked by the thin per-axis wrapper;
  // capturing its initial value at init is the point, not a reactivity bug.
  // svelte-ignore state_referenced_locally
  const cfg = config

  const merge = createMergeAxisEditor(
    engine,
    cfg.axis,
    cfg.getItems(engine),
    cfg.messages
  )
  const editor = merge.editor

  // ── Id-keyed selections for this axis ──────────────────────────────────────
  const sel = idKeyedSelection<K, TSel>(cfg.field)

  const session = createSelectionSession<TSel>({
    initial: sel.clone(cfg.getSelections(engine)),
    reservedIds: () =>
      referencedSelectionIds(
        grid.items,
        cfg.axis === 'participant' ? 'participantSelectionId' : 'stimulusSelectionId'
      ),
    groups: () => editor.groups,
    ...sel.membership,
    renameItem: editor.handleNameInput,
    reorderGroups: editor.reorderGroups,
    notify: msg => toastState.addInfo(msg),
  })

  const chips = $derived(selectionChips(session, cfg.noun))

  // ── Row edits (reference media), held until Apply ─────────────────────────
  let pendingMedia = $state.raw<Record<number, StimulusMediaUpdate>>({})
  const mediaOf = (id: number) =>
    id in pendingMedia
      ? pendingMedia[id].media
      : (engine.metadata?.stimuliMedia?.[id] ?? null)

  const onRowAction = async (item: BaseInterpretedDataType) => {
    const update = await modalState.push(stimulusMediaModal, {
      stimulusId: item.id,
      stimulusName: item.displayedName || item.originalName,
      pending: pendingMedia[item.id],
    })
    if (!update) return
    // An edit that lands back on the saved media (same file and settings, or
    // removing media that was never saved) leaves nothing to save.
    const { [item.id]: _, ...rest } = pendingMedia
    const stored = engine.metadata?.stimuliMedia?.[item.id] ?? null
    const noop =
      update.media === null
        ? stored === null
        : stored !== null &&
          (update.blob ?? null) === engine.media.getBlob(item.id) &&
          deepEqual(update.media, stored)
    pendingMedia = noop ? rest : { ...rest, [item.id]: update }
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  // Every edit of one Apply is one undo step (applyAxisEdits runs them as children).
  const onApply = () => {
    const steps: WorkspaceCommand[] = []
    // Media first, while stimulus ids are still the ones the rows showed.
    const mediaUpdates = Object.values(pendingMedia)
    if (mediaUpdates.length > 0) steps.push({ type: 'updateStimulusMedia', updates: mediaUpdates, source })

    const items = editor.getCleanedItems()
    const reconcile = merge.itemsChanged(items)
    if (reconcile) {
      steps.push({ type: 'reconcileMerges', axis: cfg.axis, items, groups: merge.planGroups(items), source })
    }

    const committed = sel.commit(session.selections, editor.groups)
    // A reconcile may itself rewrite groups (an unmerge restores the merge-time
    // membership snapshot), so after one the selections are always re-committed;
    // otherwise only when they differ from the CURRENT engine state.
    if (reconcile || sel.canonical(committed) !== sel.canonical(cfg.getSelections(engine))) {
      steps.push(cfg.selectionsCommand(committed, source))
    }

    // A single edit keeps its own command (and toast); several become one container.
    const command: WorkspaceCommand | null =
      steps.length > 1 ? { type: 'applyAxisEdits', axis: cfg.axis, steps, source } : (steps[0] ?? null)
    if (command && !workspace.apply(command)) return
    modalState.close()
  }
</script>

<Section>
  <EditableEntityList
    groups={editor.groups}
    title={config.title}
    emptyMessage={config.emptyMessage}
    columns={cfg.rowAction ? [...cfg.columns, cfg.rowAction.column] : cfg.columns}
    onSort={editor.sort}
    onReorder={session.handleReorder}
    onRename={editor.renameAll}
    episode={session.editingId}
    selection={session.listSelection}
    previewIds={session.previewIds}
    groupNotice={merge.notice}
    grouped={{
      onNameInput: editor.handleNameInput,
      ...(cfg.rowAction
        ? {
            onRowAction,
            rowActionActive: (item: BaseInterpretedDataType) => mediaOf(item.id) !== null,
            rowActionTooltip: (item: BaseInterpretedDataType) => {
              const media = mediaOf(item.id)
              return media
                ? `${media.fileName}. Click to view, position, or remove.`
                : 'No reference media. Click to add an image or video.'
            },
            rowActionIcon: (item: BaseInterpretedDataType) =>
              mediaOf(item.id)?.kind === 'video' ? 'film' : 'image',
          }
        : {}),
    }}
  />

  <SelectionTray {session} {chips} noun={config.noun} />
</Section>

<ModalButtons {onApply} applyDisabled={editor.hasInvalidGroup} />
