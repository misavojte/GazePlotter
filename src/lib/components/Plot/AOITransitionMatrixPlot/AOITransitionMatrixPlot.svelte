<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte'
  import { getParticipants } from '$lib/stores/dataStore'
  import AOITransitionMatrixFigure from './AOITransitionMatrixFigure/AOITransitionMatrixFigure.svelte'
  import AOITransitionMatrixHeader from './AOITransitionMatrixHeader/AOITransitionMatrixHeader.svelte'
  import type { ScarfGridType } from '$lib/type/gridType'
  import { calculateTransitionMatrix } from '$lib/utils/aoiTransitionMatrixTransformations'

  // Grid item settings
  export let settings: ScarfGridType

  // Define a type for our transition data
  interface TransitionMatrixData {
    aoiNames: string[]
    matrix: number[][]
    maxValue: number
    aoiColors?: string[]
  }

  // This will store the processed transition matrix data
  let transitionData: TransitionMatrixData = {
    aoiNames: [],
    matrix: [],
    maxValue: 0,
    aoiColors: [],
  }

  // Filtered data that will be shown in the matrix
  let filteredData = { ...transitionData }

  // Min transition filter
  let minTransitions = 0

  // Container element reference
  let container: HTMLElement
  // Size tracking variables with default values
  let containerWidth = 0
  let containerHeight = 0
  let targetWidth = 0
  let targetHeight = 0
  let resizeTimeout: any = null

  // Animation related variables
  let animating = false
  const ANIMATION_DURATION = 250 // ms

  // Track participants for the selected group and stimulus
  $: participantIds = getParticipants(
    settings.groupId,
    settings.stimulusId
  ).map(participant => participant.id)

  // Recalculate whenever the stimulus or group changes
  $: {
    if (settings && participantIds) {
      transitionData = calculateTransitionMatrix(
        settings.stimulusId,
        participantIds
      )
      applyFilter()
    }
  }

  // Handle window resize events with debouncing
  function handleResize() {
    if (resizeTimeout) clearTimeout(resizeTimeout)

    // Measure container size
    if (container) {
      const rect = container.getBoundingClientRect()
      containerWidth = rect.width
      containerHeight = rect.height
    }

    // Debounce the resize calculation
    resizeTimeout = setTimeout(() => {
      if (container) {
        // Set target dimensions (will trigger animation)
        const rect = container.getBoundingClientRect()
        targetWidth = rect.width
        targetHeight = rect.height

        // Start animation
        animating = true
        setTimeout(() => {
          animating = false
        }, ANIMATION_DURATION)
      }
      resizeTimeout = null
    }, 100)
  }

  // Apply filtering when the filter changes
  function handleFilterChange(event) {
    minTransitions = event.detail.minTransitions
    applyFilter()
  }

  // Instead of storing on settings, we'll set up a global handler
  // This approach avoids circular references
  onMount(async () => {
    // Initial data calculation
    transitionData = calculateTransitionMatrix(
      settings.stimulusId,
      participantIds
    )

    applyFilter()

    // Wait for DOM to be ready
    await tick()

    // Initial size measurement
    if (container) {
      const rect = container.getBoundingClientRect()
      containerWidth = rect.width
      containerHeight = rect.height
      targetWidth = rect.width
      targetHeight = rect.height
    }

    // Set up resize event listener
    window.addEventListener('resize', handleResize)

    // Force initial resize calculation
    handleResize()
  })

  // Clean up our global references on destroy
  onDestroy(() => {
    // Clean up resize handler
    window.removeEventListener('resize', handleResize)
    if (resizeTimeout) clearTimeout(resizeTimeout)
  })

  // Apply filtering to the transition matrix
  function applyFilter() {
    // Create a deep copy of the matrix
    const filteredMatrix = transitionData.matrix.map(row => [...row])

    // Apply the filter
    for (let i = 0; i < filteredMatrix.length; i++) {
      for (let j = 0; j < filteredMatrix[i].length; j++) {
        if (filteredMatrix[i][j] < minTransitions) {
          filteredMatrix[i][j] = 0
        }
      }
    }

    // Update the filtered data
    filteredData = {
      aoiNames: transitionData.aoiNames,
      matrix: filteredMatrix,
      maxValue: transitionData.maxValue,
      aoiColors: transitionData.aoiColors,
    }
  }
</script>

<div class="aoi-transition-matrix-plot-container">
  <div class="header">
    <AOITransitionMatrixHeader
      bind:settings
      maxTransitionValue={transitionData.maxValue}
      on:filterChange={handleFilterChange}
    />
  </div>

  <div class="figure" bind:this={container}>
    <AOITransitionMatrixFigure
      data={filteredData}
      {settings}
      width={animating ? targetWidth : containerWidth}
      height={animating ? targetHeight : containerHeight}
      {animating}
    />
  </div>
</div>

<style>
  .aoi-transition-matrix-plot-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
  }

  .header {
    padding: 0 0 10px 0;
    margin-bottom: 10px;
  }

  .figure {
    flex: 1;
    overflow: hidden;
    position: relative;
  }
</style>
