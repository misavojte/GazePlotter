<script lang="ts">
  import { Section, ModalButtons } from '$lib/modals'
  import { getGazePlotterSession } from '$lib/session'
  import { getAllCategories, getCategoriesSelections } from '$lib/data/engine'
  import EditableEntityList from '../shared/EditableEntityList.svelte'
  import SelectionTray from '../shared/SelectionTray.svelte'
  import {
    createGroupedEntityEditor,
    type MergeCard,
  } from '../shared/groupedEntityEditor.svelte'
  import { createSelectionSession } from '../shared/selectionSession.svelte'
  import {
    idKeyedSelection,
    referencedSelectionIds,
    selectionChips,
  } from '../shared/selectionAdapters'
  import {
    FIXATION_CATEGORY_ID,
    type BaseInterpretedDataType,
    type EntitySelection,
  } from '$lib/data/types'

  interface Props {
    source: string
  }

  let { source }: Props = $props()
  const { engine, grid, modalState, workspace, toastState } = getGazePlotterSession()

  // Fixation is a normal eye-movement type here (recolorable, selectable in
  // SELECTIONS) EXCEPT its displayed name: id 0 is the substrate every AOI
  // metric and the scarf's AOI layer scan, so the name is a locked identity
  // anchor — no rename, no merge into or out of it. The editor owns the lock
  // set; the list and session read it from there.
  const editor = createGroupedEntityEditor({
    getItems: () => getAllCategories(engine),
    lockedNameIds: new Set([FIXATION_CATEGORY_ID]),
  })

  // A row renamed into the reserved name folds into Fixation's card — an
  // invalid group: notice + Undo, and Apply stays blocked while it exists.
  const fixationNotice = (group: MergeCard<BaseInterpretedDataType>) => {
    if (editor.conflictsFor(group).length === 0) return null
    return {
      tone: 'warn' as const,
      message:
        'Fixation is the reserved baseline type. Other types can’t take its name.',
      action: { label: 'Undo', onClick: () => editor.acknowledge(group) },
    }
  }

  // Id-keyed selections (stored as metadata.categoriesSelections), consumed
  // by the scarf's layers and the eye-movement comparison — a "Fixations
  // only" filter is a selection holding just id 0.
  const sel = idKeyedSelection<'memberIds', EntitySelection>('memberIds')

  const session = createSelectionSession<EntitySelection>({
    initial: sel.clone(getCategoriesSelections(engine)),
    reservedIds: () => referencedSelectionIds(grid.items, 'categorySelectionId'),
    groups: () => editor.groups,
    ...sel.membership,
    renameItem: editor.handleNameInput,
    reorderGroups: editor.reorderGroups,
    notify: msg => toastState.addInfo(msg),
    lockedNameIds: editor.lockedNameIds,
  })

  const chips = $derived(selectionChips(session, 'types'))

  const COLUMNS = [
    { label: 'Move', width: '28px', type: 'handle' as const },
    {
      label: 'Original',
      width: '1fr',
      type: 'readonly' as const,
      key: 'originalName',
    },
    {
      label: 'Displayed',
      width: '1fr',
      type: 'text' as const,
      key: 'displayedName',
    },
    {
      label: 'Color',
      width: '40px',
      type: 'color' as const,
      align: 'center' as const,
    },
  ]

  const SORT_COLUMNS = [
    { label: 'Original name', column: 'originalName' },
    { label: 'Displayed name', column: 'displayedName' },
  ]

  const handleSubmit = () => {
    if (editor.hasInvalidGroup) return
    // hidden = [] retires visibility for good (selections replace it).
    const applied = workspace.apply({
      type: 'updateCategories',
      categories: editor.getCleanedItems(),
      source,
    })
    if (!applied) return

    const committed = sel.commit(session.selections, editor.groups)
    if (
      sel.canonical(committed) !==
      sel.canonical(getCategoriesSelections(engine))
    ) {
      const saved = workspace.apply({
        type: 'updateSelections',
        axis: 'category',
        selections: committed,
        source,
      })
      if (!saved) return
    }
    modalState.close()
  }
</script>

<Section>
  <EditableEntityList
    groups={editor.groups}
    title="Eye-movement Types"
    emptyMessage="No eye-movement categories found"
    columns={COLUMNS}
    sortColumns={SORT_COLUMNS}
    onSort={editor.sort}
    onReorder={session.handleReorder}
    onRename={editor.renameAll}
    episode={session.editingId}
    selection={session.listSelection}
    previewIds={session.previewIds}
    groupNotice={fixationNotice}
    lockedNameIds={editor.lockedNameIds}
    grouped={{
      onNameInput: editor.handleNameInput,
      onColorInput: editor.handleColorInput,
    }}
  />

  <SelectionTray {session} {chips} noun="types" />

  <ModalButtons
    buttons={[
      {
        label: 'Apply',
        onclick: handleSubmit,
        variant: 'primary',
        isDisabled: editor.hasInvalidGroup,
      },
      { label: 'Cancel', onclick: () => modalState.close() },
    ]}
  />
</Section>
