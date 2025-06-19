<script lang="ts">
  import { SortableTableHeader, SectionHeader, ModalButtons } from '$lib/modals'
  import {
    getStimuli,
    updateMultipleStimuli,
  } from '$lib/gaze-data/front-process/stores/dataStore'
  import { addErrorToast, addSuccessToast } from '$lib/toaster'
  import type { BaseInterpretedDataType } from '$lib/gaze-data/shared/types'
  import { flip } from 'svelte/animate'
  import { fade } from 'svelte/transition'
  import GeneralPositionControl from '$lib/shared/components/GeneralPositionControl.svelte'
  import GeneralEmpty from '$lib/shared/components/GeneralEmpty.svelte'
  import PatternRenamingTool from './PatternRenamingTool.svelte'

  interface Props {
    forceRedraw: () => void
  }

  let { forceRedraw }: Props = $props()

  // Sorting state
  let sortColumn = $state<'originalName' | 'displayedName' | null>(null)
  let sortDirection = $state<'asc' | 'desc' | null>(null)

  const moveItem = (
    stimuli: BaseInterpretedDataType[],
    stimulus: BaseInterpretedDataType,
    direction: 'up' | 'down'
  ): BaseInterpretedDataType[] => {
    const currentIndex = stimuli.indexOf(stimulus)

    if (direction === 'up' && currentIndex > 0) {
      return [
        ...stimuli.slice(0, currentIndex - 1),
        stimuli[currentIndex],
        stimuli[currentIndex - 1],
        ...stimuli.slice(currentIndex + 1),
      ]
    }

    if (direction === 'down' && currentIndex < stimuli.length - 1) {
      return [
        ...stimuli.slice(0, currentIndex),
        stimuli[currentIndex + 1],
        stimuli[currentIndex],
        ...stimuli.slice(currentIndex + 2),
      ]
    }

    return stimuli
  }

  const deepCopyStimuli = (
    stimuli: BaseInterpretedDataType[]
  ): BaseInterpretedDataType[] =>
    stimuli.map(stimulus => ({
      id: stimulus.id,
      originalName: stimulus.originalName,
      displayedName: stimulus.displayedName,
    }))

  const rawStimuli = getStimuli()
  let stimulusObjects: BaseInterpretedDataType[] = $state(
    deepCopyStimuli(rawStimuli)
  )

  const handleObjectPositionUp = (stimulus: BaseInterpretedDataType) => {
    stimulusObjects = moveItem(stimulusObjects, stimulus, 'up')
    sortColumn = null
    sortDirection = null
  }

  const handleObjectPositionDown = (stimulus: BaseInterpretedDataType) => {
    stimulusObjects = moveItem(stimulusObjects, stimulus, 'down')
    sortColumn = null
    sortDirection = null
  }

  const handlePatternRename = (findText: string, replaceText: string) => {
    stimulusObjects = stimulusObjects.map(stimulus => ({
      ...stimulus,
      displayedName: stimulus.displayedName.replace(
        new RegExp(findText, 'g'),
        replaceText
      ),
    }))
  }

  const handleSubmit = () => {
    try {
      const stimulusObjectsCopy = deepCopyStimuli(stimulusObjects)
      updateMultipleStimuli(stimulusObjectsCopy)
      addSuccessToast('Stimuli updated successfully')
      // Refresh the stimuli list after the store update
      requestAnimationFrame(() => {
        const refreshedStimuli = getStimuli()
        stimulusObjects = deepCopyStimuli(refreshedStimuli)
        // Trigger a redraw of all visualizations
        forceRedraw()
      })
    } catch (e) {
      console.error(e)
      addErrorToast(
        'Error while updating stimuli. See console for more details.'
      )
    }
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

    stimulusObjects = [...stimulusObjects].sort((a, b) => {
      const compare = naturalSort(a[params.column], b[params.column])
      return params.newSortDirection === 'asc' ? compare : -compare
    })
  }
</script>

<div class="content">
  <PatternRenamingTool onRenameCommand={handlePatternRename} />
</div>

<SectionHeader text="Stimuli" />
{#if stimulusObjects.length === 0}
  <GeneralEmpty message="No stimuli found" />
{/if}
{#if stimulusObjects.length > 0}
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
      {#each stimulusObjects as stimulus (stimulus.id)}
        <tr
          class="gr-line"
          animate:flip={{ duration: 250 }}
          in:fade={{ duration: 200 }}
        >
          <td class="original-name">{stimulus.originalName}</td>
          <td>
            <input
              type="text"
              id={stimulus.id + 'displayedName'}
              bind:value={stimulus.displayedName}
            />
          </td>
          <td>
            <div class="button-group">
              <GeneralPositionControl
                isFirst={stimulusObjects.indexOf(stimulus) === 0}
                isLast={stimulusObjects.indexOf(stimulus) ===
                  stimulusObjects.length - 1}
                onMoveDown={() => handleObjectPositionDown(stimulus)}
                onMoveUp={() => handleObjectPositionUp(stimulus)}
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
