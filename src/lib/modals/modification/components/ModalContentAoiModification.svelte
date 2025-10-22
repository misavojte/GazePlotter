<script lang="ts">
  import GeneralRadio from '$lib/shared/components/GeneralRadio.svelte'
  import GeneralSelectBase from '$lib/shared/components/GeneralSelect.svelte'
  import { GeneralInputColor } from '$lib/shared/components'
  import {
    SortableTableHeader,
    SectionHeader,
    ModalButtons,
    IntroductoryParagraph,
  } from '$lib/modals'
  import { modalStore } from '$lib/modals/shared/stores/modalStore'
  import {
    getAllAois,
  } from '$lib/gaze-data/front-process/stores/dataStore'
  import { addErrorToast, addInfoToast } from '$lib/toaster'
  import type { ExtendedInterpretedDataType } from '$lib/gaze-data/shared/types'
  import { flip } from 'svelte/animate'
  import { fade } from 'svelte/transition'
  import GeneralPositionControl from '$lib/shared/components/GeneralPositionControl.svelte'
  import GeneralEmpty from '$lib/shared/components/GeneralEmpty.svelte'
  import { getStimuliOptions } from '$lib/plots/shared/utils/sharedPlotUtils'
  import type { WorkspaceInstruction } from '$lib/shared/types/workspaceInstructions'
  
  interface Props {
    selectedStimulus?: string
    userSelected?: string
    onInstruction: (instruction: WorkspaceInstruction) => void
  }

  let {
    selectedStimulus = $bindable('0'),
    userSelected = $bindable('this'),
    onInstruction,
  }: Props = $props()

  const isValidMatch = (displayedName: string): boolean =>
    typeof displayedName === 'string' &&
    displayedName.trim() !== '' &&
    displayedName !== undefined

  const reorderAois = (
    aois: ExtendedInterpretedDataType[]
  ): ExtendedInterpretedDataType[] => {
    const nameGroups = new Map()

    aois.forEach((aoi, index) => {
      if (
        isValidMatch(aoi.displayedName) &&
        !nameGroups.has(aoi.displayedName)
      ) {
        nameGroups.set(aoi.displayedName, {
          firstIndex: index,
          color: aoi.color,
        })
      }
    })

    const ungroupedAois = aois.filter(
      aoi =>
        !isValidMatch(aoi.displayedName) || !nameGroups.has(aoi.displayedName)
    )

    const groupedAois = Array.from(nameGroups.entries()).flatMap(
      ([name, group]) => {
        const matchingAois = aois.filter(
          aoi => isValidMatch(aoi.displayedName) && aoi.displayedName === name
        )
        return matchingAois.map(aoi => ({ ...aoi, color: group.color }))
      }
    )

    return [...ungroupedAois, ...groupedAois]
  }

  const moveItem = (
    aois: ExtendedInterpretedDataType[],
    aoi: ExtendedInterpretedDataType,
    direction: 'up' | 'down'
  ): ExtendedInterpretedDataType[] => {
    const groupedAois = isValidMatch(aoi.displayedName)
      ? aois.filter(a => a.displayedName === aoi.displayedName)
      : [aoi]

    const firstGroupIndex = aois.indexOf(groupedAois[0])
    const currentIndex = aois.indexOf(aoi)

    if (direction === 'up' && currentIndex > 0) {
      if (groupedAois.length === 1) {
        const prevItemIndex = currentIndex - 1
        const prevItemDisplayedName = aois[prevItemIndex].displayedName

        if (isValidMatch(prevItemDisplayedName)) {
          const prevGroup = aois.filter(
            (a, i) =>
              i < currentIndex && a.displayedName === prevItemDisplayedName
          )
          const prevGroupStart = aois.indexOf(prevGroup[0])

          return [
            ...aois.slice(0, prevGroupStart),
            aoi,
            ...aois.slice(prevGroupStart, currentIndex),
            ...aois.slice(currentIndex + 1),
          ]
        }

        return [
          ...aois.slice(0, currentIndex - 1),
          aois[currentIndex],
          aois[currentIndex - 1],
          ...aois.slice(currentIndex + 1),
        ]
      } else if (firstGroupIndex > 0) {
        const prevItem = aois[firstGroupIndex - 1]
        const prevGroup = isValidMatch(prevItem.displayedName)
          ? aois.filter(a => a.displayedName === prevItem.displayedName)
          : [prevItem]
        const prevGroupStart = aois.indexOf(prevGroup[0])

        return [
          ...aois.slice(0, prevGroupStart),
          ...groupedAois,
          ...prevGroup,
          ...aois.slice(firstGroupIndex + groupedAois.length),
        ]
      }
    }

    if (direction === 'down' && currentIndex < aois.length - 1) {
      if (groupedAois.length === 1) {
        return [
          ...aois.slice(0, currentIndex),
          aois[currentIndex + 1],
          aois[currentIndex],
          ...aois.slice(currentIndex + 2),
        ]
      } else if (firstGroupIndex < aois.length - groupedAois.length) {
        const beforeGroup = aois.slice(0, firstGroupIndex)
        const afterGroup = aois.slice(firstGroupIndex + groupedAois.length + 1)
        const swapItem = aois[firstGroupIndex + groupedAois.length]
        return [...beforeGroup, swapItem, ...groupedAois, ...afterGroup]
      }
    }

    return aois
  }

  const deepCopyAois = (
    aois: ExtendedInterpretedDataType[]
  ): ExtendedInterpretedDataType[] =>
    aois.map(aoi => ({
      id: aoi.id,
      originalName: aoi.originalName,
      displayedName: aoi.displayedName,
      color: aoi.color,
    }))

  const rawAois = getAllAois(parseInt(selectedStimulus))
  let aoiObjects: ExtendedInterpretedDataType[] = $state(deepCopyAois(rawAois))
  let lastSelectedStimulus = $state(selectedStimulus)

  $effect(() => {
    if (selectedStimulus !== lastSelectedStimulus) {
      const rawAois = getAllAois(parseInt(selectedStimulus))
      aoiObjects = deepCopyAois(rawAois)
      lastSelectedStimulus = selectedStimulus
    }
  })

  $effect(() => {
    const reorderedResult = reorderAois([...aoiObjects])
    if (JSON.stringify(reorderedResult) !== JSON.stringify(aoiObjects)) {
      aoiObjects = reorderedResult
    }
  })

  // Sorting state
  let sortColumn = $state<'originalName' | 'displayedName' | null>(null)
  let sortDirection = $state<'asc' | 'desc' | null>(null)

  // Natural sort function for alphanumeric strings
  const naturalSort = (a: string, b: string): number => {
    const aParts = a.match(/(\d+|\D+)/g) || []
    const bParts = b.match(/(\d+|\D+)/g) || []

    for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
      const aPart = aParts[i]
      const bPart = bParts[i]

      if (/^\d+$/.test(aPart) && /^\d+$/.test(bPart)) {
        const numA = parseInt(aPart, 10)
        const numB = parseInt(bPart, 10)
        if (numA !== numB) return numA - numB
      } else {
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

    aoiObjects = [...aoiObjects].sort((a, b) => {
      const compare = naturalSort(a[params.column], b[params.column])
      return params.newSortDirection === 'asc' ? compare : -compare
    })
  }

  const handleObjectPositionUp = (aoi: ExtendedInterpretedDataType) => {
    aoiObjects = moveItem(aoiObjects, aoi, 'up')
    sortColumn = null
    sortDirection = null
  }

  const handleObjectPositionDown = (aoi: ExtendedInterpretedDataType) => {
    aoiObjects = moveItem(aoiObjects, aoi, 'down')
    sortColumn = null
    sortDirection = null
  }

  const handleSubmit = () => {
    const handlerTypeMap = {
      this: 'this_stimulus',
      all_original: 'all_by_original_name',
      all_displayed: 'all_by_displayed_name',
    } as const

    const handlerType =
      handlerTypeMap[userSelected as keyof typeof handlerTypeMap]

    try {
      const aoiObjectsCopy = deepCopyAois(aoiObjects)
      
      onInstruction({
        type: 'updateAois',
        payload: {
          aois: aoiObjectsCopy,
          stimulusId: parseInt(selectedStimulus),
          applyTo: handlerType
        }
      })

      if (handlerType !== 'this_stimulus') {
        addInfoToast('Ordering of AOIs is not updated for other stimuli')
      }

      modalStore.close()
    } catch (e) {
      console.error(e)
      addErrorToast('Error while updating AOIs. See console for more details.')
    }
  }

  const handleCancel = () => {
    modalStore.close()
  }

  const stimuliOption = getStimuliOptions()
</script>

<div class="content">
  <IntroductoryParagraph
    maxWidth="440px"
    paragraphs={[
      'Modify AOI names, colors, and grouping. Each stimulus has its own AOI list.',
      '**To create groups**, give multiple AOIs the same displayed name. The color of the first AOI with each name will be used for the entire group.',
    ]}
  />
  <GeneralSelectBase
    label="For stimulus"
    options={stimuliOption}
    bind:value={selectedStimulus}
  />
</div>

<SectionHeader text="AOIs" />
{#if aoiObjects.length === 0}
  <GeneralEmpty message="No AOIs found in stimulus" />
{/if}
{#if aoiObjects.length > 0}
  <table class="grid content">
    <thead>
      <tr class="gr-line header">
        <th>
          <SortableTableHeader
            column="originalName"
            label="Name"
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
        <th>Color</th>
        <th>Order</th>
      </tr>
    </thead>
    <tbody>
      {#each aoiObjects as aoi (aoi.id + selectedStimulus)}
        <tr
          class="gr-line"
          animate:flip={{ duration: 250 }}
          in:fade={{ duration: 200 }}
        >
          <td class="original-name">{aoi.originalName}</td>
          <td>
            <input
              type="text"
              id={aoi.id + 'displayedName'}
              bind:value={aoi.displayedName}
            />
          </td>
          {#if !isValidMatch(aoi.displayedName) || aoiObjects.findIndex(a => isValidMatch(a.displayedName) && a.displayedName === aoi.displayedName) === aoiObjects.indexOf(aoi)}
            <td class="color-cell">
              <GeneralInputColor label="" bind:value={aoi.color} />
            </td>
            <td>
              <div class="button-group">
                <GeneralPositionControl
                  isFirst={aoiObjects.indexOf(aoi) === 0}
                  isLast={aoiObjects.indexOf(aoi) === aoiObjects.length - 1}
                  onMoveDown={() => handleObjectPositionDown(aoi)}
                  onMoveUp={() => handleObjectPositionUp(aoi)}
                />
              </div>
            </td>
          {:else}
            <td colspan="2" class="group-info"
              >change name to detach from group</td
            >
          {/if}
        </tr>
      {/each}
    </tbody>
  </table>
  <div class="content">
    <GeneralRadio
      legend="Apply changes to"
      options={[
        { label: 'This stimulus', value: 'this' },
        { label: 'All by original name', value: 'all_original' },
        { label: 'All by displayed name', value: 'all_displayed' },
      ]}
      bind:userSelected
    />
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

  .color-cell {
    padding: 0;
  }

  .color-cell :global(.input) {
    margin-bottom: 0;
  }

  .color-cell :global(label) {
    display: none;
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
  .group-info {
    font-size: 12px;
    color: var(--c-midgrey);
    font-style: italic;
    width: 90px;
    line-height: 1.1;
    border: 1px solid var(--c-midgrey);
    border-radius: 5px;
    padding: 3px 7px;
  }
</style>
