<script lang="ts">
  import { Section, ModalButtons } from '$lib/modals'
  import {
    getParticipantsWithMerged,
    getParticipantsSelections,
  } from '$lib/data/engine'
  import { getGazePlotterSession } from '$lib/session'
  import EditableEntityList from '../shared/EditableEntityList.svelte'
  import SelectionTray from '../shared/SelectionTray.svelte'
  import { createMergeAxisEditor } from '../shared/mergeAxisEditor.svelte'
  import { createSelectionSession } from '../shared/selectionSession.svelte'
  import { idKeyedSelection, selectionChips } from '../shared/selectionAdapters'
  import type { ParticipantsSelection } from '$lib/data/types'

  interface Props {
    source: string
  }

  let { source }: Props = $props()
  const { modalState, toastState, workspace, engine } = getGazePlotterSession()

  const merge = createMergeAxisEditor(
    engine,
    'participant',
    getParticipantsWithMerged(engine),
    {
      conflict: n =>
        `Can't merge: recordings overlap on ${n} ${n > 1 ? 'stimuli' : 'stimulus'}.`,
      merged:
        'Merged into one participant. Rename a row apart to restore the original.',
      willMerge:
        'Will merge into one participant on Apply. Recordings are combined and it stays reversible.',
    }
  )
  const editor = merge.editor

  const COLUMNS = [
    { label: 'Move', width: '28px', type: 'handle' as const },
    {
      label: 'Original',
      width: '1fr',
      type: 'readonly' as const,
      key: 'originalName',
      tooltip: 'The participant name from the imported recording. It never changes.',
    },
    {
      label: 'Displayed',
      width: '1fr',
      type: 'text' as const,
      key: 'displayedName',
      tooltip:
        'The name plots show. Giving two rows the same displayed name merges the participants (their recordings combine).',
    },
  ]

  const SORT_COLUMNS = [
    { label: 'Original name', column: 'originalName' },
    { label: 'Displayed name', column: 'displayedName' },
  ]

  // ── Participant selections (stored as `participantsSelections`, id-keyed) ─────
  const sel = idKeyedSelection<'participantsIds', ParticipantsSelection>(
    'participantsIds'
  )

  const session = createSelectionSession<ParticipantsSelection>({
    initial: sel.clone(getParticipantsSelections(engine)),
    groups: () => editor.groups,
    ...sel.membership,
    renameItem: editor.handleNameInput,
    reorderGroups: editor.reorderGroups,
    notify: msg => toastState.addInfo(msg),
  })
  const firstRun = getParticipantsSelections(engine).length === 0

  const chips = $derived(selectionChips(session, 'participants'))

  // ── Save ──────────────────────────────────────────────────────────────────
  const onApply = () => {
    const items = editor.getItems()

    if (merge.itemsChanged(items)) {
      if (!workspace.reconcileParticipantMerges(items, merge.planGroups(items), source))
        return
    }

    const committed = sel.commit(session.selections, editor.groups)
    // Guard against the CURRENT engine state, not the modal-open snapshot:
    // the reconcile step above may itself rewrite groups (an unmerge restores
    // the merge-time membership snapshot), and comparing against the stale
    // open snapshot would skip the re-commit and silently revert selections.
    if (sel.canonical(committed) !== sel.canonical(getParticipantsSelections(engine))) {
      if (!workspace.updateParticipantsSelections(committed, source)) return
    }

    modalState.close()
  }
</script>

<svelte:window
  onkeydowncapture={session.onEscCapture}
  onpointerdowncapture={session.onOutsideDown}
/>

<Section>
  <EditableEntityList
    items={editor.groups}
    title="Participants"
    emptyMessage="No participants found"
    columns={COLUMNS}
    sortColumns={SORT_COLUMNS}
    onSort={editor.sort}
    onReorder={session.handleReorder}
    onRename={editor.renameAll}
    episode={session.editingId}
    selection={session.listSelection}
    previewIds={session.previewIds}
    groupNotice={merge.notice}
    grouped={{ onNameInput: editor.handleNameInput }}
  />

  <SelectionTray
    {session}
    {chips}
    noun="participants"
    helpText={firstRun
      ? 'A plot can show only the participants in a selection.'
      : undefined}
  />
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