<script lang="ts">
  import {
    updateParticipantsGroups,
    getParticipants,
    getParticipantsGroups,
  } from '$lib/gaze-data/front-process/stores/dataStore'
  import { addSuccessToast } from '$lib/toaster'
  import type { ParticipantsGroup } from '$lib/gaze-data/shared/types'
  import {
    GeneralButtonMajor,
    GeneralButtonMinor,
    GeneralButtonPreset,
  } from '$lib/shared/components'
  import GeneralPositionControl from '$lib/shared/components/GeneralPositionControl.svelte'
  import Bin from 'lucide-svelte/icons/trash'
  import ChevronDown from 'lucide-svelte/icons/chevron-down'
  import ChevronUp from 'lucide-svelte/icons/chevron-up'
  import GeneralEmpty from '$lib/shared/components/GeneralEmpty.svelte'
  import { fade, slide } from 'svelte/transition'
  import { flip } from 'svelte/animate'
  import GeneralInputCheck from '$lib/shared/components/GeneralInputCheck.svelte'

  interface Props {
    forceRedraw: () => void
  }

  let { forceRedraw }: Props = $props()

  // State management
  let initialGroups = $state(
    JSON.parse(JSON.stringify(getParticipantsGroups()))
  )
  let participantsGroups = $state(JSON.parse(JSON.stringify(initialGroups)))
  let hasChanged = $state(false)

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
    // Generate a unique ID using timestamp
    const id = Date.now()

    // Find the next available group number
    const existingNumbers = participantsGroups
      .map(group => {
        const match = group.name.match(/Group (\d+)/)
        return match ? parseInt(match[1], 10) : 0
      })
      .sort((a, b) => a - b)

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
    participantsGroups = participantsGroups.filter(group => group.id !== id)
    hasChanged = checkIfChanged(participantsGroups, initialGroups)
  }

  // Reset to initial state
  const resetToInitial = () => {
    participantsGroups = JSON.parse(JSON.stringify(initialGroups))
    hasChanged = false
  }

  // Update a group's properties
  const updateGroup = (id: number, updates: Partial<ParticipantsGroup>) => {
    participantsGroups = participantsGroups.map(group => {
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
    const groupsDeepCopy = participantsGroups.map(group => ({
      id: group.id,
      name: group.name,
      participantsIds: [...group.participantsIds],
    }))

    // Update the main data store with the deep copy
    updateParticipantsGroups(groupsDeepCopy)

    // Create a new snapshot after saving
    initialGroups = JSON.parse(JSON.stringify(groupsDeepCopy))
    hasChanged = false

    forceRedraw()
    addSuccessToast(`Set ${participantsGroups.length} groups.`)
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
        ? group.participantsIds.filter(id => id !== participantId)
        : [...group.participantsIds, participantId],
    }
    updateGroup(group.id, updatedGroup)
  }

  // Select all participants for a group
  const selectAllParticipants = (group: ParticipantsGroup) => {
    const updatedGroup = {
      ...group,
      participantsIds: allParticipants.map(p => p.id),
    }
    updateGroup(group.id, updatedGroup)
  }

  // Remove all participants from a group
  const removeAllParticipants = (group: ParticipantsGroup) => {
    const updatedGroup = {
      ...group,
      participantsIds: [],
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
            <input type="text" id={group.id + 'name'} bind:value={group.name} />
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
            <div
              class="participant-actions"
              in:fade|local={{ duration: 150, delay: 100 }}
              out:fade|local={{ duration: 150 }}
            >
              <GeneralButtonPreset
                label="Select all"
                onclick={() => selectAllParticipants(group)}
              />
              <GeneralButtonPreset
                label="Remove all"
                onclick={() => removeAllParticipants(group)}
              />
            </div>

            <div
              class="participant-list"
              in:fade|local={{ duration: 150, delay: 150 }}
              out:fade|local={{ duration: 150 }}
            >
              {#each allParticipants as participant (participant.id)}
                <GeneralInputCheck
                  label={participant.displayedName}
                  checked={group.participantsIds.includes(participant.id)}
                  onchange={() => toggleParticipant(group, participant.id)}
                />
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<div class="footer">
  <GeneralButtonMajor onclick={() => addGroup()}>Add group</GeneralButtonMajor>
  <GeneralButtonMajor onclick={discardChanges} isDisabled={!hasChanged}
    >Discard Changes</GeneralButtonMajor
  >
  <GeneralButtonMajor isDisabled={!hasChanged} onclick={handleSubmit}>
    Save
  </GeneralButtonMajor>
</div>

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

  .footer {
    margin-top: 2rem;
    display: flex;
    gap: 0.5rem;
  }
</style>
