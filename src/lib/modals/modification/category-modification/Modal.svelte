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
  import { idKeyedSelection, selectionChips } from '../shared/selectionAdapters'
  import {
    FIXATION_CATEGORY_ID,
    type EntitySelection,
    type ExtendedInterpretedDataType,
  } from '$lib/data/types'

  interface Props {
    source: string
  }

  let { source }: Props = $props()
  const { engine, modalState, workspace, toastState } = getGazePlotterSession()

  // Fixations are the baseline category and stay out of the editable list.
  const editor = createGroupedEntityEditor({
    getItems: () =>
      getAllCategories(engine).filter(c => c.id !== FIXATION_CATEGORY_ID),
    initialStimulusId: 0,
  })

  // Id-keyed selections (stored as metadata.categoriesSelections) — e.g. a
  // "Fixations only" style filter once plots consume them.
  const sel = idKeyedSelection<'memberIds', EntitySelection>('memberIds')

  const session = createSelectionSession<EntitySelection>({
    initial: sel.clone(getCategoriesSelections(engine)),
    groups: () => editor.groups,
    ...sel.membership,
    renameItem: (item, name, isLeader, group) =>
      editor.handleNameInput(
        item as ExtendedInterpretedDataType,
        name,
        isLeader,
        group as MergeCard
      ),
    reorderGroups: editor.reorderGroups,
    notify: msg => toastState.addInfo(msg),
  })

  const firstRun = getCategoriesSelections(engine).length === 0

  const chips = $derived(selectionChips(session, 'types'))

  const COLUMNS = [
    { label: 'Move', width: '28px', type: 'handle' as const },
    { label: 'Original', width: '1fr', type: 'readonly' as const, key: 'originalName' },
    { label: 'Displayed', width: '1fr', type: 'text' as const, key: 'displayedName' },
    { label: 'Color', width: '40px', type: 'color' as const, align: 'center' as const },
  ]

  const SORT_COLUMNS = [
    { label: 'Original name', column: 'originalName' },
    { label: 'Displayed name', column: 'displayedName' },
  ]

  const handleSubmit = () => {
    // hidden = [] retires visibility for good (selections replace it).
    if (!workspace.updateCategories(editor.getCleanedItems(), source)) return

    const committed = sel.commit(session.selections, editor.groups)
    if (
      sel.canonical(committed) !== sel.canonical(getCategoriesSelections(engine))
    ) {
      if (!workspace.updateCategoriesSelections(committed, source)) return
    }
    modalState.close()
  }
</script>

<Section>
  <EditableEntityList
    items={editor.groups}
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
    grouped={{
      onNameInput: (item, name, isLeader, group) =>
        editor.handleNameInput(item, name, isLeader, group),
      onColorInput: (group, color) => editor.handleColorInput(group, color),
    }}
  />

  <SelectionTray
    {session}
    {chips}
    noun="types"
    helpText={firstRun
      ? 'Selections let plots range over a subset of eye-movement types.'
      : undefined}
  />

  <ModalButtons
    buttons={[
      { label: 'Apply', onclick: handleSubmit, variant: 'primary' },
      { label: 'Cancel', onclick: () => modalState.close() },
    ]}
  />
</Section>
