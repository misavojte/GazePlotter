<script lang="ts">
  import {
    updateParticipantsGroups,
    getParticipants,
    getParticipantsGroups,
  } from '$lib/gaze-data/front-process/stores/dataStore'
  import {
    addGroup,
    participantsGroupsStore,
  } from '$lib/modals/modification/stores/participantsGroupStore'
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
  import ArrowRight from 'lucide-svelte/icons/arrow-right'
  import ArrowLeft from 'lucide-svelte/icons/arrow-left'
  import GeneralEmpty from '$lib/shared/components/GeneralEmpty.svelte'
  import { truncateTextToPixelWidth } from '$lib/shared/utils/textUtils'

  interface Props {
    forceRedraw: () => void
  }

  let { forceRedraw }: Props = $props()

  // State management
  let participantsGroups: ParticipantsGroup[] = $state([])
  participantsGroupsStore.subscribe(value => (participantsGroups = value))

  // Get original data for comparison - use structuredClone for complete isolation
  const originalGroups = structuredClone(getParticipantsGroups())

  // Function to check if there are unsaved changes
  const hasUnsavedChanges = () => {
    // Compare current participantsGroups with original data
    if (participantsGroups.length !== originalGroups.length) return true

    // Only compare custom groups (id > 0)
    const currentCustomGroups = participantsGroups.filter(g => g.id > 0)
    const originalCustomGroups = originalGroups.filter(g => g.id > 0)

    if (currentCustomGroups.length !== originalCustomGroups.length) return true

    // Check each group for changes
    for (const current of currentCustomGroups) {
      const original = originalCustomGroups.find(g => g.id === current.id)
      if (!original) return true

      if (current.name !== original.name) return true

      if (current.participantsIds.length !== original.participantsIds.length)
        return true

      // Check if participantsIds arrays have the same elements
      if (
        !current.participantsIds.every(id =>
          original.participantsIds.includes(id)
        )
      )
        return true
      if (
        !original.participantsIds.every(id =>
          current.participantsIds.includes(id)
        )
      )
        return true
    }

    return false
  }

  // Track expanded accordion items
  let expandedGroupIds: number[] = $state([])

  // Get all participants
  const allParticipants = getParticipants()

  // Helper functions for moving groups up/down
  const handleObjectPositionUp = (group: ParticipantsGroup) => {
    const index = participantsGroups.indexOf(group)
    if (index > 0) {
      const newGroups = [...participantsGroups]
      const temp = newGroups[index]
      newGroups[index] = newGroups[index - 1]
      newGroups[index - 1] = temp
      participantsGroups = newGroups
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
    }
  }

  const resetGroups = () => {
    participantsGroups = []
    expandedGroupIds = []
    addSuccessToast(`Cleared groups.`)
  }

  const handleSubmit = () => {
    // Create a safe deep copy of the current participantsGroups
    const groupsDeepCopy = participantsGroups.map(group => ({
      id: group.id,
      name: group.name,
      participantsIds: [...group.participantsIds],
    }))

    // Update the local store
    participantsGroupsStore.set([...groupsDeepCopy])

    // Update the main data store with the deep copy
    updateParticipantsGroups(groupsDeepCopy)

    forceRedraw()
    addSuccessToast(`Set ${participantsGroups.length} groups.`)
  }

  // Toggle accordion expansion
  const toggleAccordion = (groupId: number) => {
    if (expandedGroupIds.includes(groupId)) {
      expandedGroupIds = expandedGroupIds.filter(id => id !== groupId)
    } else {
      expandedGroupIds = [...expandedGroupIds, groupId]
    }
  }

  // Add participant to a group
  const addParticipantToGroup = (
    group: ParticipantsGroup,
    participantId: number
  ) => {
    if (!group.participantsIds.includes(participantId)) {
      group.participantsIds = [...group.participantsIds, participantId]
    }
  }

  // Remove participant from a group
  const removeParticipantFromGroup = (
    group: ParticipantsGroup,
    participantId: number
  ) => {
    if (group.participantsIds.includes(participantId)) {
      group.participantsIds = group.participantsIds.filter(
        id => id !== participantId
      )
    }
  }

  // Select all participants for a group
  const selectAllParticipants = (group: ParticipantsGroup) => {
    group.participantsIds = allParticipants.map(p => p.id)
    addSuccessToast(`Added all participants to "${group.name}".`)
  }

  // Remove all participants from a group
  const removeAllParticipants = (group: ParticipantsGroup) => {
    group.participantsIds = []
    addSuccessToast(`Removed all participants from "${group.name}".`)
  }

  // Delete a group
  const deleteGroup = (event: Event, group: ParticipantsGroup) => {
    event.stopPropagation() // Prevent accordion toggle
    participantsGroups = participantsGroups.filter(g => g.id !== group.id)
    addSuccessToast(`Deleted group ${group.name}.`)
  }

  // Get included participants for a group
  const getIncludedParticipants = (group: ParticipantsGroup) => {
    return group.participantsIds
      .map(id => allParticipants.find(p => p.id === id))
      .filter(p => p !== undefined) as NonNullable<
      (typeof allParticipants)[0]
    >[]
  }

  // Get excluded participants for a group
  const getExcludedParticipants = (group: ParticipantsGroup) => {
    return allParticipants.filter(p => !group.participantsIds.includes(p.id))
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
      <div class="accordion-item">
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
                {group.participantsIds.length} participants
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
          <div class="accordion-content">
            <div class="participant-actions">
              <GeneralButtonPreset
                label="Select all"
                onclick={() => selectAllParticipants(group)}
              />
              <GeneralButtonPreset
                label="Remove all"
                onclick={() => removeAllParticipants(group)}
              />
            </div>

            <div class="participant-columns">
              <!-- Included participants -->
              <div class="participant-column">
                <h3>Included ({group.participantsIds.length})</h3>
                {#if group.participantsIds.length === 0}
                  <div class="empty-message">No participants included</div>
                {:else}
                  <ul class="participant-list">
                    {#each getIncludedParticipants(group) as participant (participant.id)}
                      <li>
                        <div
                          class="participant-item"
                          onclick={() =>
                            removeParticipantFromGroup(group, participant.id)}
                        >
                          <span class="participant-name">
                            {truncateTextToPixelWidth(
                              participant.displayedName,
                              200,
                              14
                            )}
                          </span>
                          <span class="action-icon remove-icon">
                            <ArrowRight size={'1em'} />
                          </span>
                        </div>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </div>

              <!-- Excluded participants -->
              <div class="participant-column">
                <h3>
                  Excluded ({allParticipants.length -
                    group.participantsIds.length})
                </h3>
                <ul class="participant-list">
                  {#each getExcludedParticipants(group) as participant (participant.id)}
                    <li>
                      <div
                        class="participant-item"
                        onclick={() =>
                          addParticipantToGroup(group, participant.id)}
                      >
                        <span class="action-icon add-icon">
                          <ArrowLeft size={'1em'} />
                        </span>
                        <span class="participant-name">
                          {truncateTextToPixelWidth(
                            participant.displayedName,
                            200,
                            14
                          )}
                        </span>
                      </div>
                    </li>
                  {/each}
                </ul>
              </div>
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<div class="footer">
  <GeneralButtonMajor onclick={() => addGroup(participantsGroups)}>
    {participantsGroups.length < 1 ? 'Create' : 'Add'} group
  </GeneralButtonMajor>
  <GeneralButtonMajor onclick={resetGroups}>Clear groups</GeneralButtonMajor>
  <GeneralButtonMajor isDisabled={false} onclick={handleSubmit}>
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
  }

  .participant-actions {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }

  .participant-columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  .participant-column {
    display: flex;
    flex-direction: column;
  }

  .participant-column h3 {
    font-size: 14px;
    margin: 0 0 12px 0;
    font-weight: bold;
    color: var(--c-darkgrey);
  }

  .participant-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .participant-item {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    border-radius: var(--rounded);
    background-color: #f8f8f8;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid transparent;
    user-select: none;
    width: 200px;
  }

  .participant-item:hover {
    background-color: #eef5ff;
    border-color: #4287f5;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .participant-name {
    flex: 1;
    font-size: 14px;
    user-select: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .empty-message {
    color: var(--c-darkgrey);
    font-style: italic;
    text-align: center;
    padding: 16px;
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

  .action-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.6;
    transition: opacity 0.2s;
  }

  .participant-item:hover .action-icon {
    opacity: 1;
  }

  .add-icon {
    color: #2d8a39;
    margin-right: 8px;
    background-color: rgba(45, 138, 57, 0.1);
    padding: 4px;
    border-radius: 50%;
  }

  .remove-icon {
    color: #d32f2f;
    margin-left: 8px;
    background-color: rgba(211, 47, 47, 0.1);
    padding: 4px;
    border-radius: 50%;
  }

  /* Included participants column */
  .participant-column:first-child .participant-item {
    background-color: rgba(45, 138, 57, 0.05);
  }

  .participant-column:first-child .participant-item:hover {
    background-color: rgba(211, 47, 47, 0.1);
    border-color: #d32f2f;
  }

  /* Excluded participants column */
  .participant-column:last-child .participant-item {
    background-color: rgba(211, 47, 47, 0.05);
  }

  .participant-column:last-child .participant-item:hover {
    background-color: rgba(45, 138, 57, 0.1);
    border-color: #2d8a39;
  }
</style>
