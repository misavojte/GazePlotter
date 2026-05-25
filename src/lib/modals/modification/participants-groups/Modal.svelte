<script lang="ts">
  import { getParticipants, getParticipantsGroups } from '$lib/data/engine'
  import { getGazePlotterSession } from '$lib/session'
  import type { ParticipantsGroup } from '$lib/data/types'
  import {
    ButtonMinor,
    ButtonPreset,
    InputCheck,
  } from '$lib/shared/components'
  import { ModalButtons } from '$lib/modals'
  import InputText from '$lib/shared/components/InputText.svelte'
  import Bin from 'lucide-svelte/icons/trash'
  import ChevronDown from 'lucide-svelte/icons/chevron-down'
  import ChevronUp from 'lucide-svelte/icons/chevron-up'
  import Copy from 'lucide-svelte/icons/copy'
  import { clickOutside } from '../shared/clickOutside'
  import Plus from 'lucide-svelte/icons/plus'
  import { tick } from 'svelte'
  import { slide } from 'svelte/transition'
  import { flip } from 'svelte/animate'
  import GripVertical from 'lucide-svelte/icons/grip-vertical'
  import { createListReorder } from '../shared/listReorder.action'

  interface Props {
    source: string
  }

  let { source }: Props = $props()
  const { engine, modalState, toastState, workspace } = getGazePlotterSession()

  // State management
  let participantsGroups = $state(
    JSON.parse(JSON.stringify(getParticipantsGroups(engine)))
  )

  // Add search filter state
  let searchFilters = $state<Record<number, string>>({})

  // Filter participants based on search for a specific group
  const getFilteredParticipants = (groupId: number) => {
    const searchFilter = searchFilters[groupId] || ''
    return getParticipants(engine).filter(participant =>
      participant.displayedName
        .toLowerCase()
        .includes(searchFilter.toLowerCase())
    )
  }

  // Add a new group
  const addGroup = () => {
    // Generate the lowest available ID that's not currently in use
    const usedIds = new Set(
      participantsGroups.map((group: ParticipantsGroup) => group.id)
    )
    let id = 1
    while (usedIds.has(id)) {
      id++
    }

    // Find the next available group number
    const existingNumbers = participantsGroups
      .map((group: ParticipantsGroup) => {
        const match = group.name.match(/Group (\d+)/)
        return match ? parseInt(match[1], 10) : 0
      })
      .sort((a: number, b: number) => a - b)

    let nextNumber = 1
    for (const num of existingNumbers) {
      if (num !== nextNumber) break
      nextNumber++
    }

    const name = `Group ${nextNumber}`
    const newGroup = {
      id,
      name,
      participantsIds: [],
    }

    participantsGroups = [...participantsGroups, newGroup]
    expandedGroupIds = [id]
    tick().then(() => {
      const items = document.querySelectorAll('.accordion-item')
      items[items.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  // Remove a group
  const removeGroup = (id: number) => {
    participantsGroups = participantsGroups.filter(
      (group: ParticipantsGroup) => group.id !== id
    )
  }

  // Update a group's properties
  const updateGroup = (id: number, updates: Partial<ParticipantsGroup>) => {
    participantsGroups = participantsGroups.map((group: ParticipantsGroup) => {
      if (group.id === id) {
        return { ...group, ...updates }
      }
      return group
    })
  }

  // Drag reorder
  let dragGroupId: number | null = $state(null)

  const dragHandle = createListReorder({
    itemSelector: '.accordion-item',
    containerSelector: '.accordion',
    onDragStart: id => {
      dragGroupId = id
      expandedGroupIds = []
    },
    onDragEnd: () => {
      dragGroupId = null
    },
    onReorder: (fromIndex, toIndex) => {
      const newGroups = [...participantsGroups]
      const [moved] = newGroups.splice(fromIndex, 1)
      newGroups.splice(toIndex, 0, moved)
      participantsGroups = newGroups
    },
  })

  const handleCancel = () => {
    modalState.close()
  }

  const handleSubmit = () => {
    // Create a safe deep copy of the current participantsGroups
    const groupsDeepCopy = participantsGroups.map(
      (group: ParticipantsGroup) => ({
        id: group.id,
        name: group.name,
        participantsIds: [...group.participantsIds],
      })
    )

    if (workspace.updateParticipantsGroups(groupsDeepCopy, source)) {
      modalState.close()
    }
  }

  // Track expanded accordion items
  let expandedGroupIds: number[] = $state([])

  // Get all participants
  const allParticipants = getParticipants(engine)

  // Toggle accordion expansion
  const toggleAccordion = (groupId: number) => {
    if (expandedGroupIds.includes(groupId)) {
      expandedGroupIds = []
    } else {
      expandedGroupIds = [groupId]
    }
  }

  // Toggle participant in group
  const toggleParticipant = (
    group: ParticipantsGroup,
    participantId: number
  ) => {
    const isIncluded = group.participantsIds.includes(participantId)
    const updatedGroup = {
      ...group,
      participantsIds: isIncluded
        ? group.participantsIds.filter((id: number) => id !== participantId)
        : [...group.participantsIds, participantId],
    }
    updateGroup(group.id, updatedGroup)
  }

  // Select all visible participants for a group
  const selectAllParticipants = (group: ParticipantsGroup) => {
    const visibleParticipants = getFilteredParticipants(group.id)
    const updatedGroup = {
      ...group,
      participantsIds: [
        ...new Set([
          ...group.participantsIds,
          ...visibleParticipants.map(p => p.id),
        ]),
      ],
    }
    updateGroup(group.id, updatedGroup)
  }

  // Remove all visible participants from a group
  const removeAllParticipants = (group: ParticipantsGroup) => {
    const visibleParticipantIds = getFilteredParticipants(group.id).map(
      p => p.id
    )
    const updatedGroup = {
      ...group,
      participantsIds: group.participantsIds.filter(
        (id: number) => !visibleParticipantIds.includes(id)
      ),
    }
    updateGroup(group.id, updatedGroup)
  }

  // Duplicate a group
  const duplicateGroup = (event: Event, group: ParticipantsGroup) => {
    event.stopPropagation()
    const usedIds = new Set(
      participantsGroups.map((g: ParticipantsGroup) => g.id)
    )
    let id = 1
    while (usedIds.has(id)) {
      id++
    }

    const newGroup = {
      id,
      name: `${group.name} (copy)`,
      participantsIds: [...group.participantsIds],
    }

    const index = participantsGroups.indexOf(group)
    participantsGroups = [
      ...participantsGroups.slice(0, index + 1),
      newGroup,
      ...participantsGroups.slice(index + 1),
    ]
    expandedGroupIds = [id]
  }

  // Delete confirmation state
  let confirmingDeleteId: number | null = $state(null)

  // Delete a group (with confirmation for non-empty groups)
  const deleteGroup = (event: Event, group: ParticipantsGroup) => {
    event.stopPropagation()
    if (group.participantsIds.length > 0 && confirmingDeleteId !== group.id) {
      confirmingDeleteId = group.id
      expandedGroupIds = []
      return
    }
    confirmingDeleteId = null
    removeGroup(group.id)
    expandedGroupIds = expandedGroupIds.filter(id => id !== group.id)
    toastState.addSuccess(`Deleted group ${group.name}.`)
  }

  const cancelDelete = (event: Event) => {
    event.stopPropagation()
    confirmingDeleteId = null
  }


  // Smart select/deselect labels
  const isFiltered = (groupId: number) => (searchFilters[groupId] || '') !== ''

</script>

<div class="accordion">
  {#if participantsGroups.length === 0}
    <p class="empty-message">No custom groups yet.</p>
  {/if}

  {#each participantsGroups as group (group.id)}
      <div
        class="accordion-item"
        class:dragging={dragGroupId === group.id}
        data-group-id={group.id}
        animate:flip={{ duration: 200 }}
      >
        {#if confirmingDeleteId === group.id}
          <div
            class="accordion-header confirm"
            use:clickOutside={() => { confirmingDeleteId = null }}
          >
            <span class="confirm-label">Delete <strong>{group.name}</strong>?</span>
            <div class="button-group">
              <ButtonMinor isIcon={false} onclick={e => deleteGroup(e, group)}>
                <span class="confirm-delete">Delete</span>
              </ButtonMinor>
              <ButtonMinor isIcon={false} onclick={cancelDelete}>
                <span class="cancel-delete">Keep</span>
              </ButtonMinor>
            </div>
          </div>
        {:else}
          <div
            class="accordion-header"
            class:active={expandedGroupIds.includes(group.id)}
          >
            <div
              class="drag-handle"
              use:dragHandle={group.id}
            >
              <GripVertical size={'1em'} />
            </div>
            <div class="group-name">
              <InputText
                label="Group name"
                showLabel={false}
                fill={true}
                value={group.name}
                oninput={e => updateGroup(group.id, { name: e.detail })}
              />
            </div>
            <div class="button-group">
              <ButtonMinor
                onclick={() => toggleAccordion(group.id)}
                isIcon={false}
              >
                <span class="participant-count">
                  {group.participantsIds.length}/{allParticipants.length} participants
                </span>
                {#if expandedGroupIds.includes(group.id)}
                  <ChevronUp size={'1em'} />
                {:else}
                  <ChevronDown size={'1em'} />
                {/if}
              </ButtonMinor>
              <ButtonMinor onclick={e => duplicateGroup(e, group)}>
                <Copy size={'1em'} />
              </ButtonMinor>
              <ButtonMinor onclick={e => deleteGroup(e, group)}>
                <Bin size={'1em'} />
              </ButtonMinor>
            </div>
          </div>
        {/if}

        {#if expandedGroupIds.includes(group.id)}
          <div
            class="accordion-content"
            in:slide|local={{ duration: 150 }}
            out:slide|local={{ duration: 120 }}
          >
            <div class="search-filter">
              <InputText
                label="Search participants"
                value={searchFilters[group.id] || ''}
                oninput={e => (searchFilters[group.id] = e.detail)}
                placeholder="Search participants"
              />
            </div>

            <div class="participant-actions">
              <ButtonPreset
                label={isFiltered(group.id) ? 'Select visible' : 'Select all'}
                onclick={() => selectAllParticipants(group)}
              />
              <ButtonPreset
                label={isFiltered(group.id) ? 'Deselect visible' : 'Deselect all'}
                onclick={() => removeAllParticipants(group)}
              />
            </div>

            <div class="participant-list">
              {#each getFilteredParticipants(group.id) as participant (participant.id)}
                <InputCheck
                  label={participant.displayedName}
                  checked={group.participantsIds.includes(participant.id)}
                  onchange={() => toggleParticipant(group, participant.id)}
                />
              {/each}

              {#if getFilteredParticipants(group.id).length !== allParticipants.length}
                <div class="filter-summary">
                  {allParticipants.length -
                    getFilteredParticipants(group.id).length} participants hidden.
                  Selections persist when search is cleared.
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    {/each}

  <button class="add-group-button" onclick={addGroup}>
    <Plus size={'1em'} />
    <span>Add group</span>
  </button>
</div>

<ModalButtons
  buttons={[
    {
      label: 'Apply',
      onclick: handleSubmit,
      variant: 'primary',
    },
    {
      label: 'Cancel',
      onclick: handleCancel,
    },
  ]}
/>

<style>
  .empty-message {
    color: var(--c-darkgrey);
    font-size: 0.9rem;
    text-align: center;
    margin: 0;
  }

  .add-group-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5em;
    width: 100%;
    padding: 12px 14px;
    border: 1px dashed var(--c-midgrey);
    border-radius: var(--rounded-md);
    background: none;
    color: var(--c-darkgrey);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .add-group-button:hover {
    border-color: var(--c-brand);
    color: var(--c-brand);
    background-color: rgba(205, 20, 4, 0.03);
  }

  .accordion {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 20px;
    width: min(520px, 100%);
  }

  .accordion-item {
    border: 1px solid var(--c-border);
    border-radius: var(--rounded-md);
    overflow: hidden;
    width: 100%;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  }

  .accordion-header {
    padding: 12px 14px;
    background-color: var(--c-darkwhite);
    display: flex;
    justify-content: space-between;
    align-items: center;
    user-select: none;
    gap: 0.5rem;
  }

  .accordion-header.active {
    background-color: rgba(205, 20, 4, 0.05);
  }

  .accordion-header.confirm {
    padding: 12px 14px;
    background-color: rgba(205, 20, 4, 0.05);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }

  .confirm-label {
    font-size: 0.9rem;
    color: var(--c-darkgrey);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
    flex: 1;
  }

  .drag-handle {
    cursor: grab;
    color: var(--c-midgrey);
    display: flex;
    align-items: center;
    padding: 2px 0;
    flex-shrink: 0;
    transition: color 0.1s ease;
  }

  .drag-handle:hover {
    color: var(--c-darkgrey);
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .accordion-item.dragging {
    opacity: 0.3;
    border-style: dashed;
    border-color: var(--c-midgrey);
    box-shadow: none;
  }

  .accordion-item.dragging > * {
    visibility: hidden;
  }

  .group-name {
    flex: 1;
    min-width: 0;
  }

  .participant-count {
    font-size: 12px;
    color: var(--c-darkgrey);
    margin-right: 8px;
  }

  .accordion-content {
    padding: 14px;
    background-color: var(--c-white);
    border-top: 1px solid var(--c-border);
    overflow: visible;
  }

  .participant-actions {
    display: flex;
    gap: 8px;
    margin-bottom: 14px;
  }

  .participant-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .participant-list :global(label) {
    padding: 8px 10px;
    border-radius: var(--rounded-md);
    border: 1px solid transparent;
    background-color: var(--c-darkwhite);
    transition:
      background-color 0.15s ease,
      border-color 0.15s ease;
  }

  .participant-list :global(label:hover) {
    background-color: var(--c-white);
    border-color: var(--c-border);
  }

  .confirm-delete {
    font-size: 12px;
    color: var(--c-brand);
    font-weight: 500;
  }

  .cancel-delete {
    font-size: 12px;
    color: var(--c-darkgrey);
  }

  .button-group {
    display: flex;
    gap: 5px;
    flex-direction: row;
    flex-wrap: nowrap;
    margin-left: 5px;
  }

  .search-filter {
    margin-bottom: 14px;
  }

  .search-filter :global(input) {
    width: 100% !important;
  }

  .filter-summary {
    padding: 8px 12px;
    border: 1px solid var(--c-border);
    border-radius: var(--rounded-md);
    background-color: var(--c-darkwhite);
    color: var(--c-darkgrey);
    font-size: 12px;
    text-align: left;
    margin-top: 8px;
  }
</style>
