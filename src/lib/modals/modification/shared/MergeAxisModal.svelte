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
  import type { WorkspaceCommand } from '$lib/workspace/commands'
  import type { MergeAxisMessages } from './mergeAxisEditor.svelte'
  import type { SelectionLike } from './selectionSession.svelte'
  import type { TableColumn } from './EditableEntityList.svelte'
  import type { ModalState } from '$lib/modals/modalState.svelte'
  import { stimulusMediaModal } from '../stimulus-media/definition'

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
    /** Optional per-row icon button (leader rows), e.g. the stimulus axis'
        reference-media column. `onclick` typically PUSHES a detail modal so
        this modal (and its unsaved edits) stays alive underneath. */
    rowAction?: {
      column: TableColumn
      onclick: (
        item: BaseInterpretedDataType,
        ctx: { engine: DataEngine; modalState: ModalState; source: string }
      ) => void
      isActive: (item: BaseInterpretedDataType, engine: DataEngine) => boolean
      tooltip: (item: BaseInterpretedDataType, engine: DataEngine) => string
    }
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
      onclick: (item, { modalState, source }) => {
        void modalState.push(stimulusMediaModal, {
          stimulusId: item.id,
          stimulusName: item.displayedName || item.originalName,
          source,
        })
      },
      isActive: (item, engine) =>
        engine.metadata?.stimuliMedia?.[item.id] !== undefined,
      tooltip: (item, engine) => {
        const media = engine.metadata?.stimuliMedia?.[item.id]
        return media
          ? `${media.fileName}. Click to view, position, or remove.`
          : 'No reference media. Click to add an image or video.'
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

  const SORT_COLUMNS = [
    { label: 'Original name', column: 'originalName' },
    { label: 'Displayed name', column: 'displayedName' },
  ]

  // ── Id-keyed selections for this axis ──────────────────────────────────────
  const sel = idKeyedSelection<K, TSel>(cfg.field)

  const session = createSelectionSession<TSel>({
    initial: sel.clone(cfg.getSelections(engine)),
    reservedIds: () =>
      referencedSelectionIds(
        grid.items,
        cfg.axis === 'participant' ? 'groupId' : 'stimulusSelectionId'
      ),
    groups: () => editor.groups,
    ...sel.membership,
    renameItem: editor.handleNameInput,
    reorderGroups: editor.reorderGroups,
    notify: msg => toastState.addInfo(msg),
  })

  const chips = $derived(selectionChips(session, cfg.noun))

  // ── Save ──────────────────────────────────────────────────────────────────
  const onApply = () => {
    const items = editor.getItems()

    if (merge.itemsChanged(items)) {
      const reconciled = workspace.apply({
        type: 'reconcileMerges',
        axis: cfg.axis,
        items,
        groups: merge.planGroups(items),
        source,
      })
      if (!reconciled) return
    }

    const committed = sel.commit(session.selections, editor.groups)
    // Guard against the CURRENT engine state, not the modal-open snapshot:
    // the reconcile step above may itself rewrite groups (an unmerge restores
    // the merge-time membership snapshot), and comparing against the stale
    // open snapshot would skip the re-commit and silently revert selections.
    if (sel.canonical(committed) !== sel.canonical(cfg.getSelections(engine))) {
      if (!workspace.apply(cfg.selectionsCommand(committed, source))) return
    }

    modalState.close()
  }
</script>

<Section>
  <EditableEntityList
    groups={editor.groups}
    title={config.title}
    emptyMessage={config.emptyMessage}
    columns={cfg.rowAction ? [...cfg.columns, cfg.rowAction.column] : cfg.columns}
    sortColumns={SORT_COLUMNS}
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
            onRowAction: (item: BaseInterpretedDataType) =>
              cfg.rowAction!.onclick(item, { engine, modalState, source }),
            rowActionActive: (item: BaseInterpretedDataType) =>
              cfg.rowAction!.isActive(item, engine),
            rowActionTooltip: (item: BaseInterpretedDataType) =>
              cfg.rowAction!.tooltip(item, engine),
          }
        : {}),
    }}
  />

  <SelectionTray {session} {chips} noun={config.noun} />
</Section>

<ModalButtons
  buttons={[
    {
      label: 'Apply',
      onclick: onApply,
      variant: 'primary',
      isDisabled: editor.hasInvalidGroup,
    },
    { label: 'Cancel', onclick: () => modalState.close() },
  ]}
/>
