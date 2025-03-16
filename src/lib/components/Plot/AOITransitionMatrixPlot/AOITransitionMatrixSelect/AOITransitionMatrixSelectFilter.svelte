<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  // Store the filter settings
  export let minTransitions = 0
  export let maxValue = 10

  const dispatch = createEventDispatcher()

  function updateFilter(event) {
    minTransitions = parseInt(event.target.value)
    dispatch('filterChange', { minTransitions })
  }
</script>

<div class="filter-container">
  <label for="min-transitions">Min transitions: {minTransitions}</label>
  <input
    type="range"
    id="min-transitions"
    min="0"
    max={maxValue}
    value={minTransitions}
    on:input={updateFilter}
  />
</div>

<style>
  .filter-container {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
  }

  input {
    width: 100px;
  }
</style>
