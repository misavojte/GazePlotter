<script lang="ts">
  import Select from '$lib/shared/components/Select.svelte'
  import { Section, ModalButtons } from '$lib/modals'
  import { createEventIntervalsModal } from './definition-steps'
  import { getGazePlotterSession } from '$lib/session'
  import { tooltipAction } from '$lib/tooltip'
  import {
    getEventChannels,
    getEventsSelections,
    getStimuli,
  } from '$lib/data/engine'
  import { getStimuliOptions } from '$lib/plots/shared'
  import EditableEntityList from '../shared/EditableEntityList.svelte'
  import SelectionTray from '../shared/SelectionTray.svelte'
  import { createGroupedEntityEditor } from '../shared/groupedEntityEditor.svelte'
  import { createSelectionSession } from '../shared/selectionSession.svelte'
  import {
    buildRenameMap,
    nameKeyedMembership,
    nameKeyedInertIds,
    nameKeyedChips,
    cloneNameSelections,
    canonicalNameSelections,
    commitNameSelections,
    stagedDomainNames,
  } from '../shared/nameKeyedSelection'
  import type { NameSelection } from '$lib/data/types'

  interface Props {
    selectedStimulus?: string
    source: string
  }

  let { selectedStimulus = '0', source }: Props = $props()
  const { engine, modalState, workspace, toastState } = getGazePlotterSession()

  const stimuliOptions = getStimuliOptions(engine)
  // The opener's stimulus is only the STARTING scope; `stimulus` owns it after.
  // svelte-ignore state_referenced_locally
  let stimulus = $state(
    stimuliOptions.some(o => o.value === selectedStimulus)
      ? selectedStimulus
      : (stimuliOptions[0]?.value ?? '0')
  )
  const stimulusId = () => {
    const id = parseInt(stimulus)
    return Number.isNaN(id) ? 0 : id
  }

  const editor = createGroupedEntityEditor({
    getItems: id => getEventChannels(engine, id),
    initialStimulusId: stimulusId(),
  })

  // The displayed name each channel had when this stimulus was (re)entered —
  // the stable key space selections store their members in (see renameMap).
  let openNames = $state(
    new Map(getEventChannels(engine, stimulusId()).map(c => [c.id, c.displayedName]))
  )

  // ONE scope-lifecycle rule (parity with the AOI modal): switching stimuli
  // discards the leaving stimulus's unapplied list edits by re-pulling —
  // synchronously, so the keyed list never animates a stale frame.
  const changeStimulus = (next: string) => {
    if (next === stimulus) return
    session.clearTransient()
    const id = parseInt(next)
    editor.refresh(id)
    openNames = new Map(
      getEventChannels(engine, id).map(c => [c.id, c.displayedName])
    )
    stimulus = next
  }

  // Open name → current staged name (see nameKeyedSelection). Identity usages
  // count for ambiguity so splitting a merged channel never steals the name.
  const openNameOf = (id: number) => openNames.get(id)
  const renameMap = $derived(
    buildRenameMap(
      editor.items.map(i => [openNameOf(i.id), i.displayedName] as const)
    )
  )

  // Name-keyed selections (stored as metadata.eventsSelections), portable across
  // stimuli exactly like AOI selections.
  const session = createSelectionSession<NameSelection>({
    initial: cloneNameSelections(getEventsSelections(engine)),
    groups: () => editor.groups,
    inertIds: () => inertIds,
    ...nameKeyedMembership({ renameMap: () => renameMap, openNameOf }),
    renameItem: editor.handleNameInput,
    reorderGroups: editor.reorderGroups,
    notify: msg => toastState.addInfo(msg),
  })
  const firstRun = getEventsSelections(engine).length === 0

  const inertIds = $derived(nameKeyedInertIds(editor.groups))

  const domainNames = $derived(
    stagedDomainNames(getStimuli(engine), stimulusId(), editor.items, id =>
      getEventChannels(engine, id)
    )
  )

  const chips = $derived(nameKeyedChips(session, renameMap, domainNames, 'channels'))

  const COLUMNS = [
    {
      label: 'Move',
      width: '28px',
      type: 'handle' as const,
      tooltip: 'Drag to reorder. Order drives how channels stack in overlays.',
    },
    {
      label: 'Original',
      width: '1fr',
      type: 'readonly' as const,
      key: 'originalName',
      tooltip: 'The channel name from the imported recording. It never changes.',
    },
    {
      label: 'Displayed',
      width: '1fr',
      type: 'text' as const,
      key: 'displayedName',
      tooltip:
        'The name plots show. Giving two rows the same displayed name merges them into one channel.',
    },
    { label: 'Color', width: '40px', type: 'color' as const, align: 'center' as const },
  ]

  const SORT_COLUMNS = [
    { label: 'Original name', column: 'originalName' },
    { label: 'Displayed name', column: 'displayedName' },
  ]

  const handleApply = () => {
    // Selections commit through the SAME map the session displayed — resolve
    // BEFORE the channel command rebuilds the open-name baseline. No pruning.
    const committed = commitNameSelections(renameMap, session.selections)

    // hidden = [] retires visibility for good (selections replace it).
    const applied = workspace.apply({
      type: 'updateEventChannels',
      channels: editor.getCleanedItems(),
      stimulusId: stimulusId(),
      source,
    })
    if (!applied) return
    if (
      canonicalNameSelections(committed) !==
      canonicalNameSelections(getEventsSelections(engine))
    ) {
      const saved = workspace.apply({
        type: 'updateSelections',
        axis: 'event',
        selections: committed,
        source,
      })
      if (!saved) return
    }
    modalState.close()
  }
</script>

<Section>
  {#key stimulus}
    <EditableEntityList
      groups={editor.groups}
      title="Event channels"
      emptyMessage="No event channels found in stimulus"
      columns={COLUMNS}
      sortColumns={SORT_COLUMNS}
      onSort={editor.sort}
      onReorder={session.handleReorder}
      onRename={editor.renameAll}
      episode={session.editingId}
      selection={session.listSelection}
      previewIds={session.previewIds}
      grouped={{
        onNameInput: editor.handleNameInput,
        onColorInput: editor.handleColorInput,
      }}
    >
      {#snippet titleExtra()}
        <div
          class="scope-select"
          use:tooltipAction={{
            content:
              'Which stimulus the list edits. Switching discards unapplied list edits.',
            position: 'bottom',
          }}
        >
          <Select
            label=""
            ariaLabel="Stimulus"
            compact={true}
            options={stimuliOptions}
            value={stimulus}
            onchange={e => changeStimulus(e.detail as string)}
          />
        </div>
      {/snippet}
    </EditableEntityList>
  {/key}

  <SelectionTray
    {session}
    {chips}
    noun="channels"
    helpText={firstRun
      ? 'A plot can overlay just the event channels in a selection.'
      : undefined}
  />

  <ModalButtons
    buttons={[
      ...(editor.groups.length > 0
        ? [
            {
              label: 'Apply',
              onclick: handleApply,
              variant: 'primary' as const,
            },
          ]
        : []),
      {
        label: 'Create intervals…',
        onclick: () => {
          // Re-pull only when the step actually created intervals (it
          // resolves `true`) — a plain Back must not discard the user's
          // unapplied edits.
          modalState
            .push(createEventIntervalsModal, { source })
            .then(created => {
              if (created) editor.refresh()
            })
        },
      },
      { label: 'Cancel', onclick: () => modalState.close() },
    ]}
  />
</Section>

<style>
  .scope-select {
    width: 150px;
  }
</style>
