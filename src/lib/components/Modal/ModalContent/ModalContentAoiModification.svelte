<script lang="ts">
  import { run } from 'svelte/legacy'

  import GeneralButtonMajor from '$lib/components/General/GeneralButton/GeneralButtonMajor.svelte'
  import GeneralRadio from '$lib/components/General/GeneralRadio/GeneralRadio.svelte'
  import GeneralSelectBase from '$lib/components/General/GeneralSelect/GeneralSelect.svelte'
  import { getAois, getStimuli, updateMultipleAoi } from '$lib/stores/dataStore'
  import {
    addErrorToast,
    addInfoToast,
    addSuccessToast,
  } from '$lib/stores/toastStore'
  import type { ExtendedInterpretedDataType } from '$lib/type/Data/InterpretedData/ExtendedInterpretedDataType'
  import { onMount } from 'svelte'
  import { flip } from 'svelte/animate'
  import { fade } from 'svelte/transition'
  import GeneralPositionControl from '$lib/components/General/GeneralPositionControl/GeneralPositionControl.svelte'
  import GeneralEmpty from '$lib/components/General/GeneralEmpty/GeneralEmpty.svelte'
  import type { GridStoreType } from '$lib/stores/gridStore'
  import { get } from 'svelte/store'

  interface Props {
    selectedStimulus?: string
    userSelected?: string
    gridStore: GridStoreType
  }

  let {
    selectedStimulus = $bindable('0'),
    userSelected = $bindable('this'),
    gridStore,
  }: Props = $props()

  // Pure functions for AOI manipulation
  const isValidMatch = (displayedName: string): boolean =>
    typeof displayedName === 'string' &&
    displayedName.trim() !== '' &&
    displayedName !== undefined

  const reorderAois = (
    aois: ExtendedInterpretedDataType[]
  ): ExtendedInterpretedDataType[] => {
    const nameGroups = new Map()

    // Find first occurrences of valid displayed names
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

    // Group AOIs by validity and matching names
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
    const newAois = [...aois]

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

    return newAois
  }

  // Reactive declarations
  let aoiObjects: ExtendedInterpretedDataType[] = $state([])

  run(() => {
    aoiObjects = getAois(parseInt(selectedStimulus))
  })

  run(() => {
    const reorderedResult = reorderAois([...aoiObjects])
    if (JSON.stringify(reorderedResult) !== JSON.stringify(aoiObjects)) {
      aoiObjects = reorderedResult
    }
  })

  // Event handlers
  const handleObjectPositionUp = (aoi: ExtendedInterpretedDataType) => {
    aoiObjects = moveItem(aoiObjects, aoi, 'up')
  }

  const handleObjectPositionDown = (aoi: ExtendedInterpretedDataType) => {
    aoiObjects = moveItem(aoiObjects, aoi, 'down')
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
      updateMultipleAoi(aoiObjects, parseInt(selectedStimulus), handlerType)
      addSuccessToast('AOIs updated successfully')
      if (handlerType !== 'this_stimulus') {
        addInfoToast('Ordering of AOIs is not updated for other stimuli')
      }
      gridStore.set(get(gridStore))
    } catch (e) {
      console.error(e)
      addErrorToast('Error while updating AOIs. See console for more details.')
    }
  }

  // Initialize
  const stimuliOption = getStimuli().map(stimulus => ({
    label: stimulus.displayedName,
    value: stimulus.id.toString(),
  }))

  onMount(() => {
    aoiObjects = getAois(parseInt(selectedStimulus))
  })
</script>

<div class="content">
  <GeneralSelectBase
    label="For stimulus"
    options={stimuliOption}
    bind:value={selectedStimulus}
  />
</div>
{#if aoiObjects.length === 0}
  <GeneralEmpty message="No AOIs found in stimulus" />
{/if}
{#if aoiObjects.length > 0}
  <table class="grid content">
    <thead>
      <tr class="gr-line header">
        <th>Name</th>
        <th>Displayed name</th>
        <th>Color</th>
        <th>Order</th>
      </tr>
    </thead>
    <tbody>
      {#each aoiObjects as aoi (aoi.id + selectedStimulus)}
        <tr class="gr-line" animate:flip in:fade>
          <td class="original-name">{aoi.originalName}</td>
          <td>
            <input
              type="text"
              id={aoi.id + 'displayedName'}
              bind:value={aoi.displayedName}
            />
          </td>
          {#if !isValidMatch(aoi.displayedName) || aoiObjects.findIndex(a => isValidMatch(a.displayedName) && a.displayedName === aoi.displayedName) === aoiObjects.indexOf(aoi)}
            <td>
              <input
                type="color"
                id={aoi.id + 'color'}
                bind:value={aoi.color}
              />
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

  input[type='color'] {
    height: 34px;
    width: 50px;
    padding: 4px;
    background: none;
    cursor: pointer;
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
