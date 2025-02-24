<script lang="ts">
  import GeneralButtonMajor from '$lib/components/General/GeneralButton/GeneralButtonMajor.svelte'
  import GeneralRadio from '$lib/components/General/GeneralRadio/GeneralRadio.svelte'
  import GeneralSelectBase from '$lib/components/General/GeneralSelect/GeneralSelect.svelte'
  import {
    getAois,
    getStimuli,
    updateMultipleAoi,
  } from '$lib/stores/dataStore.ts'
  import {
    addErrorToast,
    addInfoToast,
    addSuccessToast,
  } from '$lib/stores/toastStore.ts'
  import type { ExtendedInterpretedDataType } from '$lib/type/Data/InterpretedData/ExtendedInterpretedDataType.ts'
  import { onMount } from 'svelte'
  import { flip } from 'svelte/animate'
  import { fade } from 'svelte/transition'
  import GeneralPositionControl from '$lib/components/General/GeneralPositionControl/GeneralPositionControl.svelte'
  import GeneralEmpty from '$lib/components/General/GeneralEmpty/GeneralEmpty.svelte'
  import type { GridStoreType } from '$lib/stores/gridStore.ts'
  import { get } from 'svelte/store'

  export let selectedStimulus = '0'
  export let userSelected = 'this'
  export let gridStore: GridStoreType

  let aoiObjects: ExtendedInterpretedDataType[] =
    [] /* Order in array is also important */

  $: {
    aoiObjects = getAois(parseInt(selectedStimulus))
  }

  const isValidMatch = (displayedName: string): boolean => {
    return (
      typeof displayedName === 'string' &&
      displayedName.trim() !== '' &&
      displayedName !== undefined
    )
  }

  $: {
    // Create a new array to avoid direct mutation
    const reorderedAois = [...aoiObjects]

    // First, find all unique valid displayed names and their first occurrences
    const nameGroups = new Map()

    reorderedAois.forEach((aoi, index) => {
      if (isValidMatch(aoi.displayedName)) {
        if (!nameGroups.has(aoi.displayedName)) {
          nameGroups.set(aoi.displayedName, {
            firstIndex: index,
            color: aoi.color,
          })
        }
      }
    })

    // Now reorder all AOIs at once
    const result: ExtendedInterpretedDataType[] = []
    const processed = new Set()

    // First, add all AOIs that don't have valid matches
    reorderedAois.forEach(aoi => {
      if (
        !isValidMatch(aoi.displayedName) ||
        !nameGroups.has(aoi.displayedName)
      ) {
        result.push(aoi)
      }
    })

    // Then add all grouped AOIs in order
    nameGroups.forEach((group, name) => {
      const matchingAois = reorderedAois.filter(
        aoi => isValidMatch(aoi.displayedName) && aoi.displayedName === name
      )

      matchingAois.forEach(aoi => {
        aoi.color = group.color // Apply the color from the first occurrence
        result.push(aoi)
      })
    })

    // Update aoiObjects if the order has changed
    if (JSON.stringify(result) !== JSON.stringify(aoiObjects)) {
      aoiObjects = result
    }
  }

  /**
   * TODO: Make reactive in the future (when stimuli can be updated)
   */
  const stimuliOption = getStimuli().map(stimulus => {
    return {
      label: stimulus.displayedName,
      value: stimulus.id.toString(),
    }
  })

  onMount(() => {
    aoiObjects = getAois(parseInt(selectedStimulus))
    console.log(aoiObjects)
  })

  const handleObjectPositionUp = (aoi: ExtendedInterpretedDataType) => {
    // If this AOI is part of a group, find all AOIs in the group
    const groupedAois = isValidMatch(aoi.displayedName)
      ? aoiObjects.filter(a => a.displayedName === aoi.displayedName)
      : [aoi]

    const firstGroupIndex = aoiObjects.indexOf(groupedAois[0])
    const currentIndex = aoiObjects.indexOf(aoi)

    if (currentIndex > 0) {
      // For single items, allow moving past groups
      if (groupedAois.length === 1) {
        // Find the previous item or group's start
        const prevItemIndex = currentIndex - 1
        const prevItemDisplayedName = aoiObjects[prevItemIndex].displayedName

        // If previous item is part of a group, move above the entire group
        if (isValidMatch(prevItemDisplayedName)) {
          const prevGroup = aoiObjects.filter(
            (a, i) =>
              i < currentIndex && a.displayedName === prevItemDisplayedName
          )
          const prevGroupStart = aoiObjects.indexOf(prevGroup[0])

          aoiObjects = [
            ...aoiObjects.slice(0, prevGroupStart),
            aoi,
            ...aoiObjects.slice(prevGroupStart, currentIndex),
            ...aoiObjects.slice(currentIndex + 1),
          ]
        } else {
          // Normal swap for non-grouped items
          const beforeGroup = aoiObjects.slice(0, currentIndex - 1)
          const afterGroup = aoiObjects.slice(currentIndex + 1)
          const swapItem = aoiObjects[currentIndex - 1]

          aoiObjects = [...beforeGroup, aoi, swapItem, ...afterGroup]
        }
      } else if (firstGroupIndex > 0) {
        // For groups, move the entire group up
        const beforeGroup = aoiObjects.slice(0, firstGroupIndex - 1)
        const afterGroup = aoiObjects.slice(
          firstGroupIndex + groupedAois.length
        )
        const swapItem = aoiObjects[firstGroupIndex - 1]

        aoiObjects = [...beforeGroup, ...groupedAois, swapItem, ...afterGroup]
      }
    }
  }

  const handleObjectPositionDown = (aoi: ExtendedInterpretedDataType) => {
    // If this AOI is part of a group, find all AOIs in the group
    const groupedAois = isValidMatch(aoi.displayedName)
      ? aoiObjects.filter(a => a.displayedName === aoi.displayedName)
      : [aoi]

    const firstGroupIndex = aoiObjects.indexOf(groupedAois[0])
    const currentIndex = aoiObjects.indexOf(aoi)

    if (currentIndex < aoiObjects.length - 1) {
      // For single items, allow moving past groups
      if (groupedAois.length === 1) {
        const beforeGroup = aoiObjects.slice(0, currentIndex)
        const afterGroup = aoiObjects.slice(currentIndex + 2)
        const swapItem = aoiObjects[currentIndex + 1]

        aoiObjects = [...beforeGroup, swapItem, aoi, ...afterGroup]
      } else if (firstGroupIndex < aoiObjects.length - groupedAois.length) {
        // For groups, move the entire group down
        const beforeGroup = aoiObjects.slice(0, firstGroupIndex)
        const afterGroup = aoiObjects.slice(
          firstGroupIndex + groupedAois.length + 1
        )
        const swapItem = aoiObjects[firstGroupIndex + groupedAois.length]

        aoiObjects = [...beforeGroup, swapItem, ...groupedAois, ...afterGroup]
      }
    }
  }

  const handleSubmit = () => {
    let handlerTypeForAoiStore:
      | 'this_stimulus'
      | 'all_by_original_name'
      | 'all_by_displayed_name' = 'this_stimulus'
    if (userSelected === 'all_original')
      handlerTypeForAoiStore = 'all_by_original_name'
    if (userSelected === 'all_displayed')
      handlerTypeForAoiStore = 'all_by_displayed_name'
    try {
      updateMultipleAoi(
        aoiObjects,
        parseInt(selectedStimulus),
        handlerTypeForAoiStore
      )
    } catch (e) {
      console.error(e)
      addErrorToast('Error while updating AOIs. See console for more details.')
    }
    addSuccessToast('AOIs updated successfully')
    if (handlerTypeForAoiStore !== 'this_stimulus') {
      addInfoToast('Ordering of AOIs is not updated for other stimuli')
    }
    gridStore.set(get(gridStore))
  }
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
  <GeneralButtonMajor on:click={handleSubmit}>Apply</GeneralButtonMajor>
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
