<script lang="ts">
  import { getContext, createEventDispatcher } from 'svelte'
  import type { AOITransitionMatrixGridType } from '$lib/type/gridType'
  import type { GridStoreType } from '$lib/stores/gridStore'
  import StimulusSelect from '../AOITransitionMatrixSelect/AOITransitionMatrixSelectStimulus.svelte'
  import GroupSelect from '../AOITransitionMatrixSelect/AOITransitionMatrixSelectGroup.svelte'
  import MenuButton from '../AOITransitionMatrixButton/AOITransitionMatrixButtonMenu.svelte'
  import FilterSelect from '../AOITransitionMatrixSelect/AOITransitionMatrixSelectFilter.svelte'

  export let settings: AOITransitionMatrixGridType
  export let maxTransitionValue = 10
  export let minTransitions = 0

  const dispatch = createEventDispatcher()

  function handleFilterChange(event) {
    // Forward the filter change to the parent component
    dispatch('filterChange', { minTransitions: event.detail.minTransitions })
  }
</script>

<div class="header">
  <StimulusSelect bind:settings />
  <GroupSelect bind:settings />
  <FilterSelect
    bind:minTransitions
    maxValue={maxTransitionValue}
    on:filterChange={handleFilterChange}
  />
  <MenuButton bind:settings />
</div>

<style>
  .header {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
    align-items: center;
  }
</style>
