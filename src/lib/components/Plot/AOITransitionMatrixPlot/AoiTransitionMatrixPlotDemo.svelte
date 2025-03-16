<script lang="ts">
  import AoiTransitionMatrixPlot from './AoiTransitionMatrixPlot.svelte'
  import GeneralInputText from '$lib/components/General/GeneralInput/GeneralInputText.svelte'

  // Demo AOI labels
  let aoiLabels = ['Text', 'Image', 'Button', 'Menu', 'Header']

  // Demo transition matrix
  let transitionMatrix = [
    [5, 12, 3, 0, 2], // From Text to others
    [8, 3, 10, 1, 0], // From Image to others
    [1, 9, 0, 5, 1], // From Button to others
    [0, 2, 6, 4, 3], // From Menu to others
    [3, 1, 0, 7, 2], // From Header to others
  ]

  // Plot dimensions
  let width = 500
  let height = 550

  // Demo styling props
  let cellSize = 50
  let colorScale = ['#f7fbff', '#08306b']

  // For adding new AOI
  let newAoiName = ''

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

  function resetDemo() {
    aoiLabels = ['Text', 'Image', 'Button', 'Menu', 'Header']
    transitionMatrix = [
      [5, 12, 3, 0, 2],
      [8, 3, 10, 1, 0],
      [1, 9, 0, 5, 1],
      [0, 2, 6, 4, 3],
      [3, 1, 0, 7, 2],
    ]
  }
</script>

<div class="demo-container">
  <h2>AOI Transition Matrix Plot Demo</h2>

  <div class="plot-container">
    <AoiTransitionMatrixPlot
      {aoiTransitionMatrix}
      {aoiLabels}
      {width}
      {height}
      {cellSize}
      {colorScale}
      xLabel="From AOI"
      yLabel="To AOI"
      legendTitle="Transition Count"
    />
  </div>

  <div class="controls">
    <h3>Controls</h3>
    <div class="input-group">
      <GeneralInputText bind:value={newAoiName} label="New AOI Name" />
      <button on:click={addAoi}>Add AOI</button>
    </div>
    <div class="button-group">
      <button on:click={resetDemo}>Reset Demo</button>
    </div>
  </div>
</div>

<style>
  .demo-container {
    font-family: Arial, sans-serif;
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
  }

  h2 {
    text-align: center;
    margin-bottom: 20px;
  }

  h3 {
    margin-bottom: 10px;
  }

  .plot-container {
    display: flex;
    justify-content: center;
    margin-bottom: 20px;
  }

  .controls {
    background-color: #f5f5f5;
    border-radius: 8px;
    padding: 15px;
  }

  .input-group {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }

  .button-group {
    display: flex;
    justify-content: flex-start;
    gap: 10px;
  }

  button {
    padding: 8px 16px;
    background-color: #4a90e2;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  }

  button:hover {
    background-color: #3a80d2;
  }
</style>
