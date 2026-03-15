<script lang="ts">
  import PanelButtonUpload from '$lib/workspace/panel/components/PanelButtonUpload.svelte'
  import PanelButtonDemo from '$lib/workspace/panel/components/PanelButtonDemo.svelte'
  import { fade } from 'svelte/transition'
  import ButtonMajor from '$lib/shared/components/ButtonMajor.svelte'
  import { getGazePlotterSession } from '$lib/session'
  import { metadataInfoModal } from '$lib/modals/definitions'
  import type { GridItemSnapshot } from '$lib/workspace'

  interface Props {
    onReinitialize: () => void
    initialLayoutState?: GridItemSnapshot[] | null
  }

  const { onReinitialize, initialLayoutState = null }: Props = $props()
  const { engine, errorService, ingest, modalState, workspace } =
    getGazePlotterSession()

  /**
   * Determines if the reset layout button should be shown.
   * Valid data means we have loaded actual stimuli and participants.
   */
  const canResetLayout = $derived(engine.hasValidData)
  const fatalLoadError = $derived(errorService.fatalLoad)
  const canOpenErrorReport = $derived(
    fatalLoadError !== null || ingest.metadata !== null
  )

  /**
   * Opens the metadata modal to show the error report.
   * This is useful when file upload fails and users want to see details.
   */
  const openErrorReport = () => {
    modalState.open(metadataInfoModal, {})
  }

  /**
   * Handles layout reset by creating a setLayoutState command with the initial layout state.
   * This replaces the direct callback approach with a proper workspace command.
   */
  const handleResetLayout = () => {
    if (!initialLayoutState) {
      errorService.report({
        origin: 'workspace',
        severity: 'recoverable',
        userMessage: 'The initial workspace layout is unavailable.',
        cause: new Error(
          'Cannot reset layout: no initial layout state provided'
        ),
        context: {
          component: 'IndicatorEmpty',
        },
      })
      return
    }
    workspace.resetLayout(initialLayoutState)
  }
</script>

<div class="empty-workspace-indicator" transition:fade={{ duration: 400 }}>
  <div class="indicator-card">
    <div class="indicator-header">
      <h3 class="indicator-title">
        {#if fatalLoadError}
          Data Load Failed
        {:else if canResetLayout}
          Workspace Empty
        {:else}
          No Data Loaded
        {/if}
      </h3>
    </div>
    <div class="indicator-body">
      <div class="content-inner">
        <p>
          {#if fatalLoadError}
            {fatalLoadError.userMessage} You can inspect the report, upload different
            data, or reload the initial data.
          {:else if canResetLayout}
            Data is available in memory, but no visualisations are displayed.
            You can reload the views, upload new data, or explore our sample
            data.
          {:else}
            Upload new data or reload the initial sample data to start working
            with the workspace.
          {/if}
        </p>
        <div class="actions">
          {#if fatalLoadError && canOpenErrorReport}
            <ButtonMajor onclick={openErrorReport}>Open Report</ButtonMajor>
          {:else if canResetLayout}
            <ButtonMajor onclick={handleResetLayout}>Reset Layout</ButtonMajor>
          {/if}
          <PanelButtonUpload />
          <PanelButtonDemo {onReinitialize} />
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .empty-workspace-indicator {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }

  .indicator-card {
    max-width: 500px;
    width: 100%;
    box-sizing: border-box;
    background-color: var(--c-lightgrey);
    border-radius: var(--rounded-lg, 8px);
    border: 1px solid var(--c-border);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .indicator-header {
    display: flex;
    align-items: center;
    padding: 8px 16px;
    background: var(--c-lightgrey);
  }

  .indicator-title {
    margin: 2px 0 2px 4px;
    font-size: 13px;
    font-weight: 600;
    color: var(--c-black);
  }

  .indicator-body {
    padding: 20px;
    background-color: var(--c-white);
  }

  .content-inner {
    text-align: left;
  }

  p {
    margin: 0 0 1.5rem 0;
    color: var(--c-text);
    line-height: 1.5;
    font-size: 14px;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }

  @media (max-width: 600px) {
    .indicator-card {
      margin: 0 1rem;
    }
  }
</style>
