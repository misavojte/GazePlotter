<script lang="ts">
  import {
    getParticipants,
    getParticipantsGroups,
  } from '$lib/gaze-data/front-process/stores/dataStore'
  import { addSuccessToast } from '$lib/toaster'
  import type { ParticipantsGroup } from '$lib/gaze-data/shared/types/index'
  import {
    GeneralButtonMinor,
    GeneralButtonPreset,
  } from '$lib/shared/components'
  import { ModalButtons, IntroductoryParagraph } from '$lib/modals'
  import GeneralPositionControl from '$lib/shared/components/GeneralPositionControl.svelte'
  import GeneralInputText from '$lib/shared/components/GeneralInputText.svelte'
  import Bin from 'lucide-svelte/icons/trash'
  import ChevronDown from 'lucide-svelte/icons/chevron-down'
  import ChevronUp from 'lucide-svelte/icons/chevron-up'
  import GeneralEmpty from '$lib/shared/components/GeneralEmpty.svelte'
  import { fade, slide } from 'svelte/transition'
  import { flip } from 'svelte/animate'
  import GeneralInputCheck from '$lib/shared/components/GeneralInputCheck.svelte'
  import type { WorkspaceCommand } from '$lib/shared/types/workspaceInstructions'
  import { modalStore } from '$lib/modals/shared/stores/modalStore'

  interface Props {
    onWorkspaceCommand: (command: WorkspaceCommand) => void
  }

  let { onWorkspaceCommand }: Props = $props()

  // State management
  let initialGroups = $state(
    JSON.parse(JSON.stringify(getParticipantsGroups()))
  )
  let participantsGroups = $state(JSON.parse(JSON.stringify(initialGroups)))
  let hasChanged = $state(false)

  // Add search filter state
  let searchFilters = $state<Record<number, string>>({})

  // Filter participants based on search for a specific group
  const getFilteredParticipants = (groupId: number) => {
    const searchFilter = searchFilters[groupId] || ''
    return getParticipants().filter(participant =>
      participant.displayedName
        .toLowerCase()
        .includes(searchFilter.toLowerCase())
    )
  }

  // Helper to check if current state differs from initial
  const checkIfChanged = (
    current: ParticipantsGroup[],
    initial: ParticipantsGroup[]
  ): boolean => {
    if (current.length !== initial.length) return true

    // Check if order has changed
    for (let i = 0; i < current.length; i++) {
      if (current[i].id !== initial[i].id) return true
    }

    // Check if any group has changed
    for (let i = 0; i < current.length; i++) {
      const currentGroup = current[i]
      const initialGroup = initial.find(g => g.id === currentGroup.id)

      if (!initialGroup) return true // New group added

      // Check if name or participants have changed
      if (currentGroup.name !== initialGroup.name) return true
      if (
        currentGroup.participantsIds.length !==
        initialGroup.participantsIds.length
      )
        return true

      // Check if any participant was added or removed
      for (const id of currentGroup.participantsIds) {
        if (!initialGroup.participantsIds.includes(id)) return true
      }
    }

    return false
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
    hasChanged = checkIfChanged(participantsGroups, initialGroups)
  }

  // Remove a group
  const removeGroup = (id: number) => {
    participantsGroups = participantsGroups.filter(
      (group: ParticipantsGroup) => group.id !== id
    )
    hasChanged = checkIfChanged(participantsGroups, initialGroups)
  }

  // Reset to initial state
  const resetToInitial = () => {
    participantsGroups = JSON.parse(JSON.stringify(initialGroups))
    hasChanged = false
  }

  // Update a group's properties
  const updateGroup = (id: number, updates: Partial<ParticipantsGroup>) => {
    participantsGroups = participantsGroups.map((group: ParticipantsGroup) => {
      if (group.id === id) {
        return { ...group, ...updates }
      }
      return group
    })
    hasChanged = checkIfChanged(participantsGroups, initialGroups)
  }

  // Helper functions for moving groups up/down
  const handleObjectPositionUp = (group: ParticipantsGroup) => {
    const index = participantsGroups.indexOf(group)
    if (index > 0) {
      const newGroups = [...participantsGroups]
      const temp = newGroups[index]
      newGroups[index] = newGroups[index - 1]
      newGroups[index - 1] = temp
      participantsGroups = newGroups
      hasChanged = checkIfChanged(participantsGroups, initialGroups)
    }
  }

  const handleObjectPositionDown = (group: ParticipantsGroup) => {
    const index = participantsGroups.indexOf(group)
    if (index < participantsGroups.length - 1) {
      const newGroups = [...participantsGroups]
      const temp = newGroups[index]
      newGroups[index] = newGroups[index + 1]
      newGroups[index + 1] = temp
      participantsGroups = newGroups
      hasChanged = checkIfChanged(participantsGroups, initialGroups)
    }
  }

  const discardChanges = () => {
    resetToInitial()
    expandedGroupIds = []
    addSuccessToast(`Unsaved changes discarded.`)
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

    onWorkspaceCommand({
      type: 'updateParticipantsGroups',
      groups: groupsDeepCopy
    })

    modalStore.close()
  }

  // Track expanded accordion items
  let expandedGroupIds: number[] = $state([])

  // Get all participants
  const allParticipants = getParticipants()

  // Toggle accordion expansion
  const toggleAccordion = (groupId: number) => {
    if (expandedGroupIds.includes(groupId)) {
      expandedGroupIds = expandedGroupIds.filter(id => id !== groupId)
    } else {
      expandedGroupIds = [...expandedGroupIds, groupId]
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
        id => !visibleParticipantIds.includes(id)
      ),
    }
    updateGroup(group.id, updatedGroup)
  }

  // Delete a group
  const deleteGroup = (event: Event, group: ParticipantsGroup) => {
    event.stopPropagation() // Prevent accordion toggle
    removeGroup(group.id)
    expandedGroupIds = expandedGroupIds.filter(id => id !== group.id)
    addSuccessToast(`Deleted group ${group.name}.`)
  }

  // Create handler functions for each group to avoid event propagation to the accordion header
  const createMoveUpHandler = (group: ParticipantsGroup) => {
    return () => {
      handleObjectPositionUp(group)
    }
  }

  const createMoveDownHandler = (group: ParticipantsGroup) => {
    return () => {
      handleObjectPositionDown(group)
    }
  }
</script>

<IntroductoryParagraph
  maxWidth="500px"
  paragraphs={[
    'Create and manage custom participant groups for analysis. Groups help organize participants by conditions, demographics, or other criteria.',
  ]}
/>

{#if participantsGroups.length === 0}
  <div class="select-wrapper">
    <GeneralEmpty message="No custom groups yet." />
  </div>
{:else}
  <div class="accordion">
    {#each participantsGroups as group (group.id)}
      <div
        class="accordion-item"
        animate:flip={{ duration: 250 }}
        in:fade={{ duration: 200 }}
      >
        <div
          class="accordion-header"
          class:active={expandedGroupIds.includes(group.id)}
        >
          <div class="group-name">
            <input
              type="text"
              id={group.id + 'name'}
              value={group.name}
              oninput={e => updateGroup(group.id, { name: e.currentTarget.value })}
            />
          </div>
          <div class="button-group">
            <GeneralButtonMinor
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
            </GeneralButtonMinor>
            <GeneralPositionControl
              isFirst={participantsGroups.indexOf(group) === 0}
              isLast={participantsGroups.indexOf(group) ===
                participantsGroups.length - 1}
              onMoveUp={createMoveUpHandler(group)}
              onMoveDown={createMoveDownHandler(group)}
            />
            <GeneralButtonMinor onclick={e => deleteGroup(e, group)}>
              <Bin size={'1em'} />
            </GeneralButtonMinor>
          </div>
        </div>

        {#if expandedGroupIds.includes(group.id)}
          <div
            class="accordion-content"
            in:slide|local={{ duration: 200, delay: 50 }}
            out:slide|local={{ duration: 200 }}
          >
            <div class="search-filter">
              <GeneralInputText
                label="Search participants"
                value={searchFilters[group.id] || ''}
                oninput={e => (searchFilters[group.id] = e.detail)}
                placeholder="All participants are shown when search is empty"
              />
            </div>

            <div
              class="participant-actions"
              in:fade|local={{ duration: 150, delay: 100 }}
              out:fade|local={{ duration: 150 }}
            >
              <GeneralButtonPreset
                label="Select visible"
                onclick={() => selectAllParticipants(group)}
              />
              <GeneralButtonPreset
                label="Deselect visible"
                onclick={() => removeAllParticipants(group)}
              />
            </div>

            <div
              class="participant-list"
              in:fade|local={{ duration: 150, delay: 150 }}
              out:fade|local={{ duration: 150 }}
            >
              {#each getFilteredParticipants(group.id) as participant (participant.id)}
                <GeneralInputCheck
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
  </div>
{/if}

<ModalButtons
  buttons={[
    {
      label: 'Save',
      onclick: handleSubmit,
      isDisabled: !hasChanged,
      variant: 'primary',
    },
    {
      label: 'Discard Changes',
      onclick: discardChanges,
      isDisabled: !hasChanged,
    },
    {
      label: 'Add group',
      onclick: addGroup,
    },
  ]}
/>

<style>
  .select-wrapper {
    margin-bottom: 1em;
    display: flex;
    flex-direction: column;
    gap: 1em;
  }

  .accordion {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 20px;
  }

  .accordion-item {
    border: 1px solid var(--c-darkgrey);
    border-radius: var(--rounded);
    overflow: hidden;
    width: 472px;
  }

  .accordion-header {
    padding: 12px 16px;
    background-color: #f8f8f8;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    user-select: none;
  }

  .accordion-header.active {
    background-color: #eef5ff;
  }

  .group-name {
    flex: 1;
  }

  .participant-count {
    font-size: 12px;
    color: var(--c-darkgrey);
    margin-right: 8px;
  }

  .accordion-content {
    padding: 16px;
    background-color: #ffffff;
    border-top: 1px solid var(--c-lightgrey);
    overflow: visible;
  }

  .participant-actions {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }

  .participant-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .participant-list :global(label) {
    padding: 8px;
    border-radius: var(--rounded);
    background-color: #f8f8f8;
    transition: all 0.2s ease;
  }

  .participant-list :global(label:hover) {
    background-color: #eef5ff;
  }

  .button-group {
    display: flex;
    gap: 5px;
    flex-direction: row;
    flex-wrap: nowrap;
    margin-left: 5px;
  }

  input {
    height: 34px;
    box-sizing: border-box;
    border: 1px solid var(--c-darkgrey);
    border-radius: var(--rounded);
    margin: 0;
    padding: 0.5rem;
    width: 100%;
  }

  .search-filter {
    margin-bottom: 16px;
  }

  .search-filter :global(input) {
    width: 100% !important;
  }

  .filter-summary {
    padding: 8px 14px;
    border-radius: var(--rounded);
    background-color: var(--c-lightgrey);
    color: var(--c-darkgrey);
    font-size: 12px;
    text-align: left;
    margin-top: 8px;
  }
</style>
