<script lang="ts">
  import {
    SortableTableHeader,
    SectionHeader,
    ModalButtons,
    IntroductoryParagraph,
  } from '$lib/modals'
  import { modalStore } from '$lib/modals/shared/stores/modalStore'
  import {
    getAllParticipants,
  } from '$lib/gaze-data/front-process/stores/dataStore'
  import { addErrorToast } from '$lib/toaster'
  import type { BaseInterpretedDataType } from '$lib/gaze-data/shared/types'
  import { flip } from 'svelte/animate'
  import { fade } from 'svelte/transition'
  import GeneralPositionControl from '$lib/shared/components/GeneralPositionControl.svelte'
  import GeneralEmpty from '$lib/shared/components/GeneralEmpty.svelte'
  import PatternRenamingTool from './PatternRenamingTool.svelte'
  import type { UpdateParticipantsCommand } from '$lib/shared/types/workspaceInstructions'

  interface Props {
    source: string,
    onWorkspaceCommand: (command: UpdateParticipantsCommand) => void
  }

  let { source, onWorkspaceCommand }: Props = $props()

  // Sorting state
  let sortColumn = $state<'originalName' | 'displayedName' | null>(null)
  let sortDirection = $state<'asc' | 'desc' | null>(null)

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

  const handlePatternRename = (findText: string, replaceText: string) => {
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
      
      onWorkspaceCommand({
        type: 'updateParticipants',
        participants: participantObjectsCopy,
        source,
      })

      modalStore.close()
    } catch (e) {
      console.error(e)
      addErrorToast(
        'Error while updating participants. See console for more details.'
      )
    }
  }

  const handleCancel = () => {
    modalStore.close()
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

  const handleSort = (params: {
    column: 'originalName' | 'displayedName'
    newSortDirection: 'asc' | 'desc'
  }) => {
    sortColumn = params.column
    sortDirection = params.newSortDirection

    participantObjects = [...participantObjects].sort((a, b) => {
      const compare = naturalSort(a[params.column], b[params.column])
      return params.newSortDirection === 'asc' ? compare : -compare
    })
  }
</script>

<IntroductoryParagraph
  maxWidth="400px"
  paragraphs={[
    'Modify participant display names and order. Use pattern renaming to efficiently update multiple participants at once.',
  ]}
/>

<div class="content">
  <PatternRenamingTool
    onRenameCommand={(findText: string, replaceText: string) => handlePatternRename(findText, replaceText)}
  />
</div>

<SectionHeader text="Participants" />
{#if participantObjects.length === 0}
  <GeneralEmpty message="No participants found" />
{/if}
{#if participantObjects.length > 0}
  <table class="grid content">
    <thead>
      <tr class="gr-line header">
        <th>
          <SortableTableHeader
            column="originalName"
            label="Original name"
            {sortColumn}
            {sortDirection}
            onSort={handleSort}
          />
        </th>
        <th>
          <SortableTableHeader
            column="displayedName"
            label="Displayed name"
            {sortColumn}
            {sortDirection}
            onSort={handleSort}
          />
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
              value={participant.displayedName}
              oninput={(e) => {
                const target = e.currentTarget
                const participantId = participant.id
                // Find and update the participant by ID in the current array
                // This ensures we update the correct object even after sorting
                const index = participantObjects.findIndex(p => p.id === participantId)
                if (index !== -1) {
                  // Create a new array with the updated object to ensure reactivity
                  participantObjects = participantObjects.map((p, i) => 
                    i === index ? { ...p, displayedName: target.value } : p
                  )
                }
              }}
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
</style>
