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

  export let selectedStimulus = '0'
  export let userSelected = 'this'
  let aoiObjects: ExtendedInterpretedDataType[] =
    [] /* Order in array is also important */

  $: {
    aoiObjects = getAois(parseInt(selectedStimulus))
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
    const index = aoiObjects.indexOf(aoi)
    if (index > 0) {
      aoiObjects = [
        ...aoiObjects.slice(0, index - 1),
        aoiObjects[index],
        aoiObjects[index - 1],
        ...aoiObjects.slice(index + 1),
      ]
    }
  }

  const handleObjectPositionDown = (aoi: ExtendedInterpretedDataType) => {
    const index = aoiObjects.indexOf(aoi)
    if (index < aoiObjects.length - 1) {
      aoiObjects = [
        ...aoiObjects.slice(0, index),
        aoiObjects[index + 1],
        aoiObjects[index],
        ...aoiObjects.slice(index + 2),
      ]
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
          <td>
            <input type="color" id={aoi.id + 'color'} bind:value={aoi.color} />
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
</style>
