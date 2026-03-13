<script lang="ts">
  import PanelButtonUpload from '$lib/workspace/panel/components/PanelButtonUpload.svelte'
  import PanelButtonDemo from '$lib/workspace/panel/components/PanelButtonDemo.svelte'
  import { fade } from 'svelte/transition'
  import GeneralButtonMajor from '$lib/shared/components/GeneralButtonMajor.svelte'
  import { getGazePlotterSession } from '$lib/session'
  import { ModalContentMetadataInfo } from '$lib/modals/info/components'
  import GridItemContainer from '$lib/workspace/grid/GridItemContainer.svelte'
  import type { GridItemSnapshot } from '$lib/workspace/type/gridType'

  interface Props {
    onReinitialize: () => void
    initialLayoutState?: GridItemSnapshot[] | null
  }

  const {
    onReinitialize,
    initialLayoutState = null,
  }: Props = $props()
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
    modalState.open(ModalContentMetadataInfo as any, 'Metadata Report')
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
        cause: new Error('Cannot reset layout: no initial layout state provided'),
        context: {
          component: 'WorkspaceIndicatorEmpty',
        },
      })
      return
    }
    workspace.resetLayout(initialLayoutState)
  }
</script>

<div class="empty-workspace-indicator" transition:fade={{ duration: 400 }}>
  <GridItemContainer class="indicator-content">
    {#snippet header()}
      <h3>
        {#if fatalLoadError}
          Data Load Failed
        {:else if canResetLayout}
          Workspace Empty
        {:else}
          No Data Loaded
        {/if}
      </h3>
    {/snippet}
    {#snippet body()}
      <div class="content-inner">
        <p>
          {#if fatalLoadError}
            {fatalLoadError.userMessage} You can inspect the report, upload
            different data, or reload the initial data.
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
            <GeneralButtonMajor onclick={openErrorReport}
              >Open Report</GeneralButtonMajor
            >
          {:else if canResetLayout}
            <GeneralButtonMajor onclick={handleResetLayout}
              >Reset Layout</GeneralButtonMajor
            >
          {/if}
          <PanelButtonUpload />
          <PanelButtonDemo {onReinitialize} />
        </div>
      </div>
    {/snippet}
  </GridItemContainer>
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

  :global(.indicator-content) {
    max-width: 500px;
    width: 100%;
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
    :global(.indicator-content) {
      margin: 0 1rem;
    }
  }
</style>
