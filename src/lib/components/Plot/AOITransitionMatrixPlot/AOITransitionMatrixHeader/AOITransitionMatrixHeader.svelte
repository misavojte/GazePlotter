<script lang="ts">
  import { getContext, createEventDispatcher } from 'svelte'
  import type { ScarfGridType } from '$lib/type/gridType'
  import type { GridStoreType } from '$lib/stores/gridStore'
  import StimulusSelect from '../AOITransitionMatrixSelect/AOITransitionMatrixSelectStimulus.svelte'
  import GroupSelect from '../AOITransitionMatrixSelect/AOITransitionMatrixSelectGroup.svelte'
  import MenuButton from '../AOITransitionMatrixButton/AOITransitionMatrixButtonMenu.svelte'
  import FilterSelect from '../AOITransitionMatrixSelect/AOITransitionMatrixSelectFilter.svelte'

  export let settings: ScarfGridType
  // This is now set from the maxValue in the main component's data
  export let maxTransitionValue = 10
  export let minTransitions = 0

  const dispatch = createEventDispatcher()
  const store = getContext<GridStoreType>('gridStore')

  function handleFilterChange(event) {
    // We'll dispatch this event to be caught by the Workspace component
    // which will forward it to the main component
    dispatch('filterChange', event.detail)
  }
</script>

<div class="nav">
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
  .nav {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
    background: inherit;
    align-items: center;
  }
</style>
