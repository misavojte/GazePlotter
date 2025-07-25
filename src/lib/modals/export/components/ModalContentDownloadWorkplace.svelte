<script lang="ts">
  import { SectionHeader } from '$lib/modals'
  import { WorkplaceDownloader } from '$lib/modals/export/class/WorkplaceDownloader.js'
  import { getData } from '$lib/gaze-data/front-process/stores/dataStore.js'
  import { modalStore } from '$lib/modals/shared/stores/modalStore'
  import {
    ModalContentExportSegmentedData,
    ModalContentExportScangraph,
    ModalContentExportAggregatedData,
  } from '$lib/modals/export/components'

  const type = 'inner-json'
  let fileName = $state('GazePlotter-Export')

  const handleSubmit = () => {
    if (type === 'inner-json') {
      const downloader = new WorkplaceDownloader()
      downloader.download(getData(), fileName)
    }
  }

  const handleOpenSegmentedExport = () => {
    modalStore.open(
      ModalContentExportSegmentedData as any,
      'Export Segmented Data'
    )
  }

  const handleOpenScangraphExport = () => {
    modalStore.open(ModalContentExportScangraph as any, 'Export ScanGraph')
  }

  const handleOpenAggregatedExport = () => {
    modalStore.open(
      ModalContentExportAggregatedData as any,
      'Export Aggregated Data'
    )
  }
</script>

<div class="container">
  <section class="section">
    <SectionHeader text="Export Workspace" />
    <div class="content">
      <p class="workspace-description">
        Preserves all data, layout, and settings in a compact JSON file. Perfect
        for sharing dashboards.
      </p>
      <div class="workspace-export">
        <div class="export-inline">
          <input
            type="text"
            bind:value={fileName}
            placeholder="File name"
            class="export-input"
          />
          <button onclick={handleSubmit} class="export-button">
            Export Workspace
          </button>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <SectionHeader text="Other Export Options" />
    <div class="content">
      <p class="info-text">
        Choose from specialized export formats for different analysis needs:
      </p>
      <div class="export-options">
        <button class="export-option-card" onclick={handleOpenSegmentedExport}>
          <div class="export-option-content">
            <h4 class="export-option-title">Segmented Data (CSV)</h4>
            <p class="export-option-subtitle">
              Raw eye-tracking segments with timing and AOI information
            </p>
          </div>
        </button>

        <button class="export-option-card" onclick={handleOpenAggregatedExport}>
          <div class="export-option-content">
            <h4 class="export-option-title">Aggregated Data (CSV)</h4>
            <p class="export-option-subtitle">
              Statistical metrics like dwell time, fixation counts, and
              durations
            </p>
          </div>
        </button>

        <button class="export-option-card" onclick={handleOpenScangraphExport}>
          <div class="export-option-content">
            <h4 class="export-option-title">ScanGraph Format</h4>
            <p class="export-option-subtitle">
              Scanpath data for similarity analysis and visualization
            </p>
          </div>
        </button>
      </div>
    </div>
  </section>
</div>

<style>
  .container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 500px;
    width: 100%;
  }

  .workspace-export {
    display: flex;
    flex-direction: column;
  }

  .export-inline {
    display: flex;
    border: 1px solid #ddd;
    border-radius: 4px;
    overflow: hidden;
    background: #fff;
    transition: border-color 0.15s ease;
  }

  .export-inline:focus-within {
    border-color: #cd1404;
    box-shadow: 0 0 0 1px rgba(205, 20, 4, 0.3);
  }

  .export-input {
    flex: 1;
    border: none;
    padding: 0.6rem 0.75rem;
    font-size: 0.9rem;
    background: transparent;
    outline: none;
    color: #333;
  }

  .export-input::placeholder {
    color: #999;
  }

  .export-button {
    border: none;
    background: #cd1404;
    color: white;
    padding: 0.6rem 1rem;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.15s ease;
    white-space: nowrap;
  }

  .export-button:hover {
    background: #a20d03;
  }

  .export-button:focus {
    outline: none;
    background: #a20d03;
  }

  .workspace-description {
    margin: 0 0 1rem 0;
    color: #666;
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .info-text {
    margin: 0 0 1rem 0;
    color: #666;
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .export-options {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .export-option-card {
    display: flex;
    align-items: center;
    padding: 0.75rem 1rem;
    background: #fafafa;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
    width: 100%;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .export-option-card:hover {
    border-color: #cd1404;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transform: translateY(-1px);
  }

  .export-option-card:focus {
    outline: none;
    border-color: #cd1404;
    box-shadow: 0 0 0 2px rgba(205, 20, 4, 0.2);
  }

  .export-option-card:active {
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .export-option-content {
    flex: 1;
  }

  .export-option-title {
    margin: 0 0 0.25rem 0;
    font-size: 0.9rem;
    font-weight: 500;
    color: #333;
    line-height: 1.3;
  }

  .export-option-subtitle {
    margin: 0;
    font-size: 0.85rem;
    color: #666;
    line-height: 1.4;
  }
</style>
