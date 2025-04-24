<script lang="ts">
  import GeneralButtonMajor from '$lib/components/General/GeneralButton/GeneralButtonMajor.svelte'
  import GeneralButtonPreset from '$lib/components/General/GeneralButton/GeneralButtonPreset.svelte'
  import GeneralInputText from '$lib/components/General/GeneralInput/GeneralInputText.svelte'
  import {
    getAllParticipants,
    updateMultipleParticipants,
  } from '$lib/stores/dataStore'
  import { addErrorToast, addSuccessToast } from '$lib/stores/toastStore'
  import type { BaseInterpretedDataType } from '$lib/type/Data/InterpretedData/BaseInterpretedDataType'
  import { flip } from 'svelte/animate'
  import { fade } from 'svelte/transition'
  import GeneralPositionControl from '$lib/components/General/GeneralPositionControl/GeneralPositionControl.svelte'
  import GeneralEmpty from '$lib/components/General/GeneralEmpty/GeneralEmpty.svelte'

  interface Props {
    forceRedraw: () => void
  }

  let { forceRedraw }: Props = $props()

  // Pattern renaming state
  let findText = $state('')
  let replaceText = $state('')

  // Sorting state
  let sortColumn = $state<'originalName' | 'displayedName' | null>(null)
  let sortDirection = $state<'asc' | 'desc' | null>(null)

  const WILDCARD_PATTERNS = [
    { label: 'Any number (e.g., 123)', value: '\\d+' },
    { label: 'Any space', value: '\\s' },
    { label: 'Any letter', value: '[A-Za-z]' },
    { label: 'Any character', value: '.' },
  ]

  const moveItem = (
    participants: BaseInterpretedDataType[],
    participant: BaseInterpretedDataType,
    direction: 'up' | 'down'
  ): BaseInterpretedDataType[] => {
    const currentIndex = participants.indexOf(participant)

    if (direction === 'up' && currentIndex > 0) {
      return [
        ...participants.slice(0, currentIndex - 1),
        participants[currentIndex],
        participants[currentIndex - 1],
        ...participants.slice(currentIndex + 1),
      ]
    }

    if (direction === 'down' && currentIndex < participants.length - 1) {
      return [
        ...participants.slice(0, currentIndex),
        participants[currentIndex + 1],
        participants[currentIndex],
        ...participants.slice(currentIndex + 2),
      ]
    }

    return participants
  }

  const deepCopyParticipants = (
    participants: BaseInterpretedDataType[]
  ): BaseInterpretedDataType[] =>
    participants.map(participant => ({
      id: participant.id,
      originalName: participant.originalName,
      displayedName: participant.displayedName,
    }))

  const rawParticipants = getAllParticipants()
  let participantObjects: BaseInterpretedDataType[] = $state(
    deepCopyParticipants(rawParticipants)
  )

  const handleObjectPositionUp = (participant: BaseInterpretedDataType) => {
    participantObjects = moveItem(participantObjects, participant, 'up')
    sortColumn = null
    sortDirection = null
  }

  const handleObjectPositionDown = (participant: BaseInterpretedDataType) => {
    participantObjects = moveItem(participantObjects, participant, 'down')
    sortColumn = null
    sortDirection = null
  }

  const handlePatternRename = () => {
    if (!findText) return

    participantObjects = participantObjects.map(participant => ({
      ...participant,
      displayedName: participant.displayedName.replace(
        new RegExp(findText, 'g'),
        replaceText
      ),
    }))
  }

  const handleSubmit = () => {
    try {
      const participantObjectsCopy = deepCopyParticipants(participantObjects)
      updateMultipleParticipants(participantObjectsCopy)
      addSuccessToast('Participants updated successfully')
      // Refresh the participants list after the store update
      requestAnimationFrame(() => {
        const refreshedParticipants = getAllParticipants()
        participantObjects = deepCopyParticipants(refreshedParticipants)
        // Trigger a redraw of all visualizations
        forceRedraw()
      })
    } catch (e) {
      console.error(e)
      addErrorToast(
        'Error while updating participants. See console for more details.'
      )
    }
  }

  const handleFindTextInput = (event: CustomEvent) => {
    findText = event.detail
  }

  const handleReplaceTextInput = (event: CustomEvent) => {
    replaceText = event.detail
  }

  const handlePatternButtonClick = (pattern: string) => {
    findText += pattern
  }

  // Natural sort function for alphanumeric strings
  const naturalSort = (a: string, b: string): number => {
    const aParts = a.match(/(\d+|\D+)/g) || []
    const bParts = b.match(/(\d+|\D+)/g) || []

    for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
      const aPart = aParts[i]
      const bPart = bParts[i]

      // If both parts are numbers, compare numerically
      if (/^\d+$/.test(aPart) && /^\d+$/.test(bPart)) {
        const numA = parseInt(aPart, 10)
        const numB = parseInt(bPart, 10)
        if (numA !== numB) return numA - numB
      } else {
        // Otherwise compare as strings
        const strCompare = aPart.localeCompare(bPart)
        if (strCompare !== 0) return strCompare
      }
    }

    return aParts.length - bParts.length
  }

  const handleSort = (column: 'originalName' | 'displayedName') => {
    if (sortColumn === column) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        sortDirection = 'desc'
      } else if (sortDirection === 'desc') {
        sortColumn = null
        sortDirection = null
      } else {
        sortDirection = 'asc'
      }
    } else {
      sortColumn = column
      sortDirection = 'asc'
    }

    if (sortColumn && sortDirection) {
      participantObjects = [...participantObjects].sort((a, b) => {
        const compare = naturalSort(a[column], b[column])
        return sortDirection === 'asc' ? compare : -compare
      })
    } else {
      // Reset to original order
      participantObjects = deepCopyParticipants(rawParticipants)
    }
  }

  // SVG icons
  const sortIcons = {
    up: `<svg width="8" height="14" viewBox="0 0 8 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 1L6 3M4 1L2 3M4 1V9" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>`,
    down: `<svg width="8" height="14" viewBox="0 0 8 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 9L2 7M4 9L6 7M4 9V1" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>`,
    both: `<svg width="8" height="14" viewBox="0 0 8 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 1L6 3M4 1L2 3M4 1V9M4 9L2 7M4 9L6 7" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>`,
  }
</script>

<div class="content">
  <div class="pattern-tool">
    <div class="section-header">Pattern Renaming</div>
    <div class="pattern-inputs">
      <div class="input-row">
        <div class="input-group">
          <GeneralInputText
            label="Find text"
            value={findText}
            oninput={handleFindTextInput}
          />
        </div>
        <div class="input-group">
          <GeneralInputText
            label="Replace with"
            value={replaceText}
            oninput={handleReplaceTextInput}
          />
        </div>
      </div>
      <div class="pattern-section">
        <div class="pattern-title">
          Wildcard Patterns (e.g., "\d+" to remove numbers", and "\s" to remove
          spaces)
        </div>
        <div class="pattern-buttons">
          {#each WILDCARD_PATTERNS as pattern}
            <GeneralButtonPreset
              label={pattern.label}
              onclick={() => handlePatternButtonClick(pattern.value)}
            />
          {/each}
        </div>
      </div>
      <div class="apply-button">
        <GeneralButtonPreset
          label="Apply to All Names"
          onclick={handlePatternRename}
        />
      </div>
    </div>
  </div>
</div>

<div class="section-header">Participants</div>
{#if participantObjects.length === 0}
  <GeneralEmpty message="No participants found" />
{/if}
{#if participantObjects.length > 0}
  <table class="grid content">
    <thead>
      <tr class="gr-line header">
        <th>
          <div class="sort-header" on:click={() => handleSort('originalName')}>
            Original name
            <span class="sort-icon">
              {@html sortColumn === 'originalName'
                ? sortDirection === 'asc'
                  ? sortIcons.up
                  : sortIcons.down
                : sortIcons.both}
            </span>
          </div>
        </th>
        <th>
          <div class="sort-header" on:click={() => handleSort('displayedName')}>
            Displayed name
            <span class="sort-icon">
              {@html sortColumn === 'displayedName'
                ? sortDirection === 'asc'
                  ? sortIcons.up
                  : sortIcons.down
                : sortIcons.both}
            </span>
          </div>
        </th>
        <th>Order</th>
      </tr>
    </thead>
    <tbody>
      {#each participantObjects as participant (participant.id)}
        <tr
          class="gr-line"
          animate:flip={{ duration: 250 }}
          in:fade={{ duration: 200 }}
        >
          <td class="original-name">{participant.originalName}</td>
          <td>
            <input
              type="text"
              id={participant.id + 'displayedName'}
              bind:value={participant.displayedName}
            />
          </td>
          <td>
            <div class="button-group">
              <GeneralPositionControl
                isFirst={participantObjects.indexOf(participant) === 0}
                isLast={participantObjects.indexOf(participant) ===
                  participantObjects.length - 1}
                onMoveDown={() => handleObjectPositionDown(participant)}
                onMoveUp={() => handleObjectPositionUp(participant)}
              />
            </div>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
  <GeneralButtonMajor onclick={handleSubmit}>Apply</GeneralButtonMajor>
{/if}

<style>
  /* Component Group */
  input {
    height: 34px;
    box-sizing: border-box;
    border: 1px solid var(--c-darkgrey);
    border-radius: var(--rounded);
    margin: 0;
    padding: 0.5rem;
  }

  .button-group {
    display: flex;
    gap: 5px;
    flex-direction: row;
  }

  th {
    text-align: left;
    font-size: 14px;
  }
  .original-name {
    font-size: 14px;
    padding-right: 10px;
    color: var(--c-midgrey);
    cursor: not-allowed;
  }
  .content {
    margin-bottom: 25px;
  }
  .original-name {
    line-height: 1;
    white-space: nowrap;
  }

  /* Pattern tool styles */
  .pattern-tool {
    margin: 20px 0;
    margin-bottom: 30px;
  }

  .section-header {
    font-weight: 600;
    margin: 0 0 0.5rem;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid #eaeaea;
  }

  .input-row {
    display: flex;
    gap: 15px;
  }

  .input-group {
    flex: 1;
  }

  .pattern-section {
    margin-top: 2px;
  }

  .pattern-title {
    font-size: 12px;
    color: var(--c-midgrey);
    margin-bottom: 3px;
  }

  .pattern-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .apply-button {
    margin-top: 10px;
  }

  .sort-header {
    display: flex;
    align-items: center;
    gap: 2px;
    cursor: pointer;
    user-select: none;
  }

  .sort-header:hover {
    color: var(--c-primary);
  }

  .sort-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    color: #999999;
    border-radius: 50%;
    transition: all 0.2s ease;
  }

  .sort-header:hover .sort-icon {
    background-color: #999999;
    color: white;
  }
</style>
