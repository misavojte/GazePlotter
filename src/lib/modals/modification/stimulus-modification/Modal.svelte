<script lang="ts">
  import { Section, ModalButtons } from '$lib/modals'
  import { getStimuliWithMerged, getStimuliSelections } from '$lib/data/engine'
  import { getGazePlotterSession } from '$lib/session'
  import EditableEntityList from '../shared/EditableEntityList.svelte'
  import SelectionTray from '../shared/SelectionTray.svelte'
  import { createMergeAxisEditor } from '../shared/mergeAxisEditor.svelte'
  import { createSelectionSession } from '../shared/selectionSession.svelte'
  import { idKeyedSelection, selectionChips } from '../shared/selectionAdapters'
  import type { EntitySelection } from '$lib/data/types'

  interface Props {
    source: string
  }

  let { source }: Props = $props()
  const { engine, modalState, workspace, toastState } = getGazePlotterSession()

  const merge = createMergeAxisEditor(
    engine,
    'stimulus',
    getStimuliWithMerged(engine),
    {
      conflict: n =>
        `Can't merge: ${n} participant${n > 1 ? 's have' : ' has'} recordings on more than one.`,
      merged:
        'Merged into one stimulus. Rename a row apart to restore the original.',
      willMerge:
        'Will merge into one stimulus on Apply. Recordings are combined and it stays reversible.',
    }
  )
  const editor = merge.editor

  // Id-keyed selections (stored as metadata.stimuliSelections); consumed by the
  // metric-matrix "Stimuli" section.
  const sel = idKeyedSelection<'memberIds', EntitySelection>('memberIds')

  const session = createSelectionSession<EntitySelection>({
    initial: sel.clone(getStimuliSelections(engine)),
    groups: () => editor.groups,
    ...sel.membership,
    renameItem: editor.handleNameInput,
    reorderGroups: editor.reorderGroups,
    notify: msg => toastState.addInfo(msg),
  })
  const firstRun = getStimuliSelections(engine).length === 0

  const chips = $derived(selectionChips(session, 'stimuli'))

  const COLUMNS = [
    { label: 'Move', width: '28px', type: 'handle' as const },
    { label: 'Original', width: '1fr', type: 'readonly' as const, key: 'originalName' },
    { label: 'Displayed', width: '1fr', type: 'text' as const, key: 'displayedName' },
  ]

  const SORT_COLUMNS = [
    { label: 'Original name', column: 'originalName' },
    { label: 'Displayed name', column: 'displayedName' },
  ]

  const onApply = () => {
    const items = editor.getItems()

    if (merge.itemsChanged(items)) {
      if (!workspace.reconcileStimulusMerges(items, merge.planGroups(items), source))
        return
    }

    const committed = sel.commit(session.selections, editor.groups)
    // Guard against the CURRENT engine state (post-reconcile), never a stale
    // modal-open snapshot.
    if (sel.canonical(committed) !== sel.canonical(getStimuliSelections(engine))) {
      if (!workspace.updateStimuliSelections(committed, source)) return
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
    title="Stimuli"
    emptyMessage="No stimuli found"
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
    noun="stimuli"
    helpText={firstRun
      ? 'The metric matrix can range over one stimulus selection.'
      : undefined}
  />

  {#if editor.groups.length > 0}
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
  {/if}
</Section>
