<script lang="ts">
  import AoiTransitionMatrixPlot from './AoiTransitionMatrixPlot.svelte'
  import GeneralInputText from '$lib/components/General/GeneralInput/GeneralInputText.svelte'

  // Demo AOI labels
  let aoiLabels = $state(['Text', 'Image', 'Button', 'Menu', 'Header'])

  // Demo transition matrix
  // [row][col] = fromAOI (rows) -> toAOI (columns)
  let transitionMatrix = [
    [5, 12, 3, 0, 2], // From Text to others
    [8, 3, 10, 1, 0], // From Image to others
    [1, 9, 0, 5, 1], // From Button to others
    [0, 2, 6, 4, 3], // From Menu to others
    [3, 1, 0, 7, 2], // From Header to others
  ]

  // Plot dimensions
  let width = $state(800)
  let height = $state(800)

  // Demo styling props
  let cellSize = $state(80)
  let colorScale = ['#f7fbff', '#08306b']

  // For adding new AOI
  let newAoiName = $state('')

  // Track filter threshold for display
  let currentThreshold = $state(0)

  function addAoi() {
    if (newAoiName.trim() === '') return

    // Add new AOI to labels
    aoiLabels = [...aoiLabels, newAoiName.trim()]

    // Expand matrix with zeros for new row and column
    const n = aoiLabels.length - 1 // Index of new AOI

    // Add new row
    transitionMatrix = [
      ...transitionMatrix.map(row => [...row, 0]), // Add zero to each existing row
      Array(n + 1).fill(0), // Add new row of zeros
    ]

    // Reset input
    newAoiName = ''
  }

  function adjustSize(widthChange, heightChange) {
    width = Math.max(400, width + widthChange)
    height = Math.max(400, height + heightChange)
  }

  function adjustCellSize(change) {
    cellSize = Math.max(20, Math.min(150, cellSize + change))
  }

  function resetDemo() {
    aoiLabels = ['Text', 'Image', 'Button', 'Menu', 'Header']
    transitionMatrix = [
      [5, 12, 3, 0, 2],
      [8, 3, 10, 1, 0],
      [1, 9, 0, 5, 1],
      [0, 2, 6, 4, 3],
      [3, 1, 0, 7, 2],
    ]
    width = 800
    height = 800
    cellSize = 80
    currentThreshold = 0
  }

  // Add size presets for testing extreme cases
  function setSizePreset(preset) {
    switch (preset) {
      case 'square':
        width = 800
        height = 800
        break
      case 'wide':
        width = 1000
        height = 400
        break
      case 'tall':
        width = 400
        height = 1000
        break
      case 'small':
        width = 300
        height = 300
        break
    }
  }

  // Calculate filtered cell percentage
  function getFilteredPercentage() {
    if (!transitionMatrix.length) return 0

    const totalCells = transitionMatrix.flat().length
    const filteredCells = transitionMatrix
      .flat()
      .filter(v => v < currentThreshold).length

    return Math.round((filteredCells / totalCells) * 100)
  }
</script>

<div class="demo-container">
  <h2>AOI Transition Matrix Plot Demo</h2>

  <div class="size-info">
    Current size: {width}x{height}px | Cell size: {cellSize}px | AOIs: {aoiLabels.length}
  </div>

  <div class="filter-info">
    Filter threshold: <span class="threshold-value">{currentThreshold}</span>
    {#if currentThreshold > 0}
      <span class="filter-detail"
        >({getFilteredPercentage()}% of cells filtered out)</span
      >
      <div class="filter-description">
        Values below the threshold are grayed out and their labels are hidden.
        Use the slider in the legend to adjust the threshold.
      </div>
    {/if}
  </div>

  <div class="plot-container" style="width: {width}px; height: {height}px;">
    <AoiTransitionMatrixPlot
      aoiTransitionMatrix={transitionMatrix}
      {aoiLabels}
      {width}
      {height}
      {cellSize}
      {colorScale}
      xLabel="To AOI"
      yLabel="From AOI"
      legendTitle="Transition Count"
      bind:minThreshold={currentThreshold}
    />
  </div>

  <div class="controls">
    <h3>Controls</h3>
    <div class="control-section">
      <h4>Size Controls</h4>
      <div class="button-group">
        <button onclick={() => adjustSize(-100, -100)}>Smaller (-100px)</button>
        <button onclick={() => adjustSize(100, 100)}>Larger (+100px)</button>
        <button onclick={() => adjustCellSize(-10)}>Smaller Cells</button>
        <button onclick={() => adjustCellSize(10)}>Larger Cells</button>
      </div>
      <h4>Presets</h4>
      <div class="button-group">
        <button onclick={() => setSizePreset('square')}>Square (800x800)</button
        >
        <button onclick={() => setSizePreset('wide')}>Wide (1000x400)</button>
        <button onclick={() => setSizePreset('tall')}>Tall (400x1000)</button>
        <button onclick={() => setSizePreset('small')}>Small (300x300)</button>
      </div>
    </div>

    <div class="control-section">
      <h4>AOI Controls</h4>
      <div class="input-group">
        <GeneralInputText bind:value={newAoiName} label="New AOI Name" />
        <button onclick={addAoi}>Add AOI</button>
      </div>
      <div class="button-group">
        <button onclick={resetDemo}>Reset Demo</button>
      </div>
    </div>
  </div>
</div>

<style>
  .demo-container {
    font-family: Arial, sans-serif;
    max-width: 95%;
    margin: 0 auto;
    padding: 20px;
  }

  h2 {
    text-align: center;
    margin-bottom: 20px;
  }

  h3,
  h4 {
    margin-bottom: 10px;
  }

  .size-info,
  .filter-info {
    text-align: center;
    margin-bottom: 10px;
    font-size: 14px;
    color: #555;
  }

  .filter-info {
    margin-bottom: 15px;
  }

  .threshold-value {
    font-weight: bold;
    color: #ff5555;
  }

  .filter-detail {
    font-style: italic;
    margin-left: 10px;
  }

  .filter-description {
    font-size: 12px;
    margin-top: 5px;
    color: #666;
  }

  .plot-container {
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 0 auto 20px;
    border: 1px solid #ddd;
    background-color: #fafafa;
    border-radius: 4px;
    overflow: hidden;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    transition:
      width 0.3s,
      height 0.3s;
  }

  .controls {
    background-color: #f5f5f5;
    border-radius: 8px;
    padding: 15px;
    margin-top: 20px;
  }

  .control-section {
    margin-bottom: 15px;
    padding-bottom: 15px;
    border-bottom: 1px solid #ddd;
  }

  .control-section:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }

  .input-group {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }

  .button-group {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 10px;
  }

  button {
    padding: 8px 16px;
    background-color: #4a90e2;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s;
  }

  button:hover {
    background-color: #3a80d2;
  }
</style>
