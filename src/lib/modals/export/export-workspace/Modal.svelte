<script lang="ts">
  import type { Component } from 'svelte'
  import { Section } from '$lib/modals'
  import type { ModalDefinition } from '$lib/modals/defineModal'
  import type { DataCapabilityRequirements } from '$lib/data/types'
  import { getGazePlotterSession } from '$lib/session'
  import { exportSegmentedDataModal } from '../export-segmented-data/definition'
  import { exportEventDataModal } from '../export-event-data/definition'
  import { exportScangraphModal } from '../export-scangraph/definition'
  import { exportMetricDataModal } from '../export-metric-data/definition'
  import { exportFiguresModal } from '../export-figures/definition'

  const { engine, exportService, grid, modalState } = getGazePlotterSession()
  let fileName = $state('GazePlotter-Export')

  // Each option follows the data it exports, in the plot definitions'
  // `requireCapabilities` vocabulary: no events → no event export, no gaze
  // segments (event-only dataset) → no segment-derived exports.
  type ExportOption = {
    definition: ModalDefinition<Component<any>, any>
    title: string
    subtitle: string
    requireCapabilities?: DataCapabilityRequirements
  }

  const researchExportOptions: ExportOption[] = [
    {
      definition: exportSegmentedDataModal,
      title: 'Segmented Data (CSV)',
      subtitle: 'Per-segment eye-tracking data with timing and AOI information',
      requireCapabilities: ['segmented'],
    },
    {
      definition: exportEventDataModal,
      title: 'Event Data (CSV)',
      subtitle: 'Event occurrences with timing per participant and stimulus',
      requireCapabilities: ['event'],
    },
    {
      definition: exportMetricDataModal,
      title: 'Metric Data (CSV)',
      subtitle:
        'Any metric from the library, long or wide format, including similarity matrices',
    },
    {
      definition: exportScangraphModal,
      title: 'ScanGraph Format',
      subtitle: 'Scanpath data for similarity analysis and visualization',
      requireCapabilities: ['segmented'],
    },
  ]

  const visibleExportOptions = $derived(
    researchExportOptions.filter(option =>
      engine.hasCapabilities(option.requireCapabilities)
    )
  )

  const handleSubmit = async () => {
    await exportService.exportWorkspace({ fileName })
  }

  const openExportModal = (
    definition: typeof researchExportOptions[number]['definition']
  ) => {
    modalState.push(definition, {})
  }
</script>

<div class="container">
  <Section title="Export Workspace">
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
  </Section>

  <Section title="Other options">
    <div class="content">
      <div class="export-options">
        {#if grid.items.length > 0}
          <button
            class="export-option-card"
            onclick={() => modalState.push(exportFiguresModal, {})}
          >
            <div class="export-option-content">
              <h4 class="export-option-title">Figures (PNG, JPG)</h4>
              <p class="export-option-subtitle">
                All or selected plots rendered at a chosen resolution in one
                download
              </p>
            </div>
          </button>
        {/if}

        {#each visibleExportOptions as option (option.title)}
          <button
            class="export-option-card"
            onclick={() => openExportModal(option.definition)}
          >
            <div class="export-option-content">
              <h4 class="export-option-title">{option.title}</h4>
              <p class="export-option-subtitle">{option.subtitle}</p>
            </div>
          </button>
        {/each}
      </div>
    </div>
  </Section>
</div>

<style>
  .container {
    display: flex;
    flex-direction: column;
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
    border: 1px solid var(--c-border);
    border-radius: var(--rounded);
    overflow: hidden;
    background: var(--c-white);
    transition: border-color var(--transition-normal) ease;
  }

  .export-inline:focus-within {
    border-color: var(--c-brand);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--c-brand) 30%, transparent);
  }

  .export-input {
    flex: 1;
    border: none;
    padding: 0.6rem 0.75rem;
    font-size: 0.9rem;
    background: transparent;
    outline: none;
    color: var(--c-text);
  }

  .export-input::placeholder {
    color: var(--c-darkgrey);
    opacity: 0.6;
  }

  .export-button {
    border: none;
    background: var(--c-brand);
    color: var(--c-white);
    padding: 0.6rem 1rem;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color var(--transition-normal) ease;
    white-space: nowrap;
  }

  .export-button:hover {
    background: var(--c-brand-dark);
  }

  .export-button:focus {
    outline: none;
    background: var(--c-brand-dark);
  }

  .workspace-description {
    margin: 0 0 1rem 0;
    color: var(--c-text);
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
    background: var(--c-darkwhite);
    border: 1px solid var(--c-border);
    border-radius: var(--rounded);
    cursor: pointer;
    transition: all var(--transition-normal) ease;
    text-align: left;
    width: 100%;
    box-shadow: var(--shadow-sm);

    &:hover {
      border-color: var(--c-brand);
      box-shadow: var(--shadow);
      transform: translateY(-1px);
    }

    &:focus {
      outline: none;
      border-color: var(--c-brand);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--c-brand) 20%, transparent);
    }

    &:active {
      transform: translateY(0);
      box-shadow: var(--shadow-sm);
    }
  }

  .export-option-content {
    flex: 1;
  }

  .export-option-title {
    margin: 0 0 0.25rem 0;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--c-text);
    line-height: 1.3;
  }

  .export-option-subtitle {
    margin: 0;
    font-size: 0.85rem;
    color: var(--c-darkgrey);
    line-height: 1.4;
  }
</style>
