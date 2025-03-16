<!-- Transition Matrix Plot Component -->
<script lang="ts">
  import { plotDataStore } from '$lib/store/plotDataStore'
  import { settings } from '$lib/store/settings'
  import { formatTransitionMatrixData } from './utils/formatTransitionMatrixData'
  import AOITransitionMatrixFigure from './AOITransitionMatrixFigure/AOITransitionMatrixFigure.svelte'
  import { calculateGridItemDimensions } from '$lib/utils/gridUtils'

  // Transition matrix data derived from the plot data store
  $: transitionData = formatTransitionMatrixData($plotDataStore)

  // Min transitions for filtering (optional, can be set with a dispatch from child component)
  let minTransitions = 0

  // Filter data based on minimum transitions
  $: filteredData =
    minTransitions > 0
      ? transitionData.filter(d => d.value >= minTransitions)
      : transitionData

  // Handle min transitions change event from the figure component
  function handleMinTransitionsChange(event) {
    minTransitions = event.detail?.minTransitions ?? 0
  }

  // Simple height and width calculation based on grid item size
  $: {
    const HEADER_HEIGHT = 50 // Constant header height
    const dimensions = calculateGridItemDimensions(
      $settings.width,
      $settings.height
    )
    width = dimensions.width
    height = dimensions.height - HEADER_HEIGHT
  }

  let width = 600
  let height = 400
</script>

<div class="transition-matrix-plot">
  <div class="figure-container">
    <AOITransitionMatrixFigure
      data={filteredData}
      {width}
      {height}
      on:minTransitionsChange={handleMinTransitionsChange}
    />
  </div>
</div>

<style>
  .transition-matrix-plot {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .figure-container {
    flex: 1;
    width: 100%;
  }
</style>
