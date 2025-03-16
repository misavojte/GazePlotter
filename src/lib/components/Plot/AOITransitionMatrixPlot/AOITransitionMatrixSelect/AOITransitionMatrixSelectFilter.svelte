<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  // Filter settings with defaults
  export let minTransitions = 0
  export let maxValue = 10

  // Ensure maxValue is at least 1 to prevent division by zero
  $: safeMaxValue = Math.max(1, isNaN(maxValue) ? 10 : maxValue)

  const dispatch = createEventDispatcher()

  // Update filter and dispatch event for parent components
  function updateFilter(event) {
    const value = parseInt(event.target.value) || 0
    minTransitions = Math.min(value, safeMaxValue)
    dispatch('filterChange', { minTransitions })
  }
</script>

<div class="filter-container">
  <label for="min-transitions">Min: {minTransitions}</label>
  <input
    type="range"
    id="min-transitions"
    min="0"
    max={safeMaxValue}
    bind:value={minTransitions}
    on:input={updateFilter}
    class="transition-slider"
  />
</div>

<style>
  .filter-container {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    margin: 0 5px;
  }

  .transition-slider {
    width: 120px;
    height: 6px;
    -webkit-appearance: none;
    appearance: none;
    background: linear-gradient(
      to right,
      rgba(67, 133, 215, 0.15),
      rgba(67, 133, 215, 1)
    );
    border-radius: 3px;
    outline: none;
  }

  .transition-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #4285f4;
    cursor: pointer;
    border: 2px solid white;
    box-shadow: 0 0 2px rgba(0, 0, 0, 0.3);
  }

  .transition-slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #4285f4;
    cursor: pointer;
    border: 2px solid white;
    box-shadow: 0 0 2px rgba(0, 0, 0, 0.3);
  }

  input {
    width: 100px;
  }
</style>
