<script lang="ts">
  import type { Component } from 'svelte'
  import FileIcon from 'lucide-svelte/icons/file'
  import FileCheck from 'lucide-svelte/icons/file-check'
  import FilePen from 'lucide-svelte/icons/file-pen'
  import { HelpText, Section } from '$lib/modals'
  import type { ModalDefinition } from '$lib/modals/defineModal'
  import type { DataCapabilityRequirements } from '$lib/data/types'
  import { getGazePlotterSession } from '$lib/session'
  import { shortcutLabel } from '$lib/workspace/keys'
  import { exportSegmentedDataModal } from '../export-segmented-data/definition'
  import { exportEventDataModal } from '../export-event-data/definition'
  import { exportScangraphModal } from '../export-scangraph/definition'
  import { exportMetricDataModal } from '../export-metric-data/definition'
  import { exportFiguresModal } from '../export-figures/definition'

  const { engine, grid, modalState, workspaceFile } =
    getGazePlotterSession()
  // svelte-ignore state_referenced_locally -- the name a download starts from
  let fileName = $state(workspaceFile.suggestedName)

  const saveKey = shortcutLabel('save')
  const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' })

  // One state, shown once: the icon carries its colour, the line below the
  // name its words.
  const saveState = $derived(workspaceFile.indicator)
  const savedAt = $derived(
    workspaceFile.savedAt ? timeFormat.format(workspaceFile.savedAt) : ''
  )
  const StateIcon = $derived(
    saveState === 'saved' ? FileCheck : saveState === 'unsaved' ? FilePen : FileIcon
  )

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

  const openExportModal = (
    definition: typeof researchExportOptions[number]['definition']
  ) => {
    modalState.push(definition, {})
  }
</script>

<div class="container">
  <Section title="Workspace">
    <div class="content">
      <div class="file-card">
        <div class="file-head">
          <span class="file-icon {saveState}">
            <StateIcon size={18} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div class="file-text">
            <span class="file-name">
              {workspaceFile.target?.name ??
                (workspaceFile.canChooseFile ? 'Not saved to a file yet' : 'Workspace file')}
            </span>
            <span class="file-hint">
              {#if workspaceFile.saving}
                Saving…
              {:else if !workspaceFile.canChooseFile}
                {#if saveState === 'saved'}
                  Downloaded at {savedAt}.
                {:else if saveState === 'unsaved'}
                  Changed since your download at {savedAt}.
                {:else}
                  Data, layout and settings in one .gazeplotter file.
                {/if}
              {:else if !workspaceFile.target}
                Choose where to save once; {saveKey} then saves into that file.
              {:else if saveState === 'unsaved'}
                Unsaved changes. {saveKey} saves them into this file.
              {:else}
                All changes saved at {savedAt}.
              {/if}
            </span>
          </div>
        </div>

        {#if workspaceFile.canChooseFile}
          <div class="file-actions">
            <button
              class="primary"
              disabled={workspaceFile.saving}
              onclick={() => workspaceFile.save()}
            >
              Save
            </button>
            <button
              class="secondary"
              disabled={workspaceFile.saving}
              onclick={() => workspaceFile.saveAs()}
            >
              Save as…
            </button>
          </div>
        {:else}
          <div class="download-row">
            <input
              type="text"
              bind:value={fileName}
              placeholder="File name"
              aria-label="File name"
            />
            <span class="extension">.gazeplotter</span>
            <button
              class="primary"
              disabled={workspaceFile.saving}
              onclick={() => workspaceFile.download(fileName)}
            >
              Download
            </button>
          </div>
          <HelpText>
            This browser cannot overwrite files, so each download is a new copy
            in your Downloads folder.
          </HelpText>
        {/if}
      </div>
    </div>
  </Section>

  <Section title="Figures and data">
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
    gap: 8px;
    max-width: 500px;
    width: 100%;
  }

  /* --- Workspace file card --- */
  .file-card {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 14px 16px;
    background: var(--c-white);
    border: 1px solid var(--c-border);
    border-radius: var(--rounded-md);
    box-shadow: var(--shadow-sm);
  }

  .file-head {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .file-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: var(--rounded);
    background: var(--c-lightgrey);
    color: var(--c-darkgrey);
    transition:
      background-color var(--transition-normal) ease,
      color var(--transition-normal) ease;
  }

  .file-icon.unsaved {
    background: color-mix(in srgb, var(--c-warning) 12%, transparent);
    color: var(--c-warning);
  }

  .file-icon.saved {
    background: color-mix(in srgb, var(--c-success) 12%, transparent);
    color: var(--c-success);
  }

  .file-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .file-name {
    overflow: hidden;
    color: var(--c-black);
    font-size: var(--text-lg);
    font-weight: 600;
    line-height: var(--leading-tight);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file-hint {
    color: var(--c-darkgrey);
    font-size: var(--text-md);
    line-height: var(--leading-normal);
    text-wrap: pretty;
  }

  .file-actions {
    display: flex;
    gap: 8px;
  }

  .primary,
  .secondary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-radius: var(--rounded);
    font-size: var(--text-lg);
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition:
      background-color var(--transition-normal) ease,
      border-color var(--transition-normal) ease;
  }

  .primary {
    border: 1px solid var(--c-brand);
    background: var(--c-brand);
    color: var(--c-white);
  }

  .primary:hover:not(:disabled),
  .primary:focus-visible {
    background: var(--c-brand-dark);
    border-color: var(--c-brand-dark);
  }

  .secondary {
    border: 1px solid var(--c-border);
    background: var(--c-white);
    color: var(--c-black);
  }

  .secondary:hover:not(:disabled),
  .secondary:focus-visible {
    border-color: var(--c-midgrey);
    background: var(--c-darkwhite);
  }

  .primary:focus-visible,
  .secondary:focus-visible {
    outline: 2px solid var(--c-info);
    outline-offset: 1px;
  }

  .primary:disabled,
  .secondary:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .download-row {
    display: flex;
    align-items: stretch;
    overflow: hidden;
    border: 1px solid var(--c-border);
    border-radius: var(--rounded);
    background: var(--c-white);
    transition: border-color var(--transition-normal) ease;
  }

  .download-row:focus-within {
    border-color: var(--c-brand);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--c-brand) 30%, transparent);
  }

  .download-row input {
    flex: 1;
    min-width: 0;
    padding: 8px 12px;
    border: none;
    background: transparent;
    color: var(--c-black);
    font-size: var(--text-lg);
    outline: none;
  }

  .download-row .extension {
    align-self: center;
    padding-right: 12px;
    color: var(--c-darkgrey);
    font-size: var(--text-lg);
  }

  .download-row .primary {
    border-radius: 0;
  }

  /* --- Figures and data --- */
  .export-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .export-option-card {
    display: flex;
    align-items: center;
    padding: 12px 16px;
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
    margin: 0 0 4px 0;
    font-size: var(--text-lg);
    font-weight: 500;
    color: var(--c-black);
    line-height: var(--leading-tight);
    text-wrap: balance;
  }

  .export-option-subtitle {
    margin: 0;
    font-size: var(--text-lg);
    color: var(--c-darkgrey);
    line-height: var(--leading-normal);
    text-wrap: pretty;
  }
</style>
