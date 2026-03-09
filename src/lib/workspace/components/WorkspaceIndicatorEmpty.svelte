<script lang="ts">
  import PanelButtonUpload from '$lib/workspace/panel/components/PanelButtonUpload.svelte'
  import PanelButtonDemo from '$lib/workspace/panel/components/PanelButtonDemo.svelte'
  import { fade } from 'svelte/transition'
  import GeneralButtonMajor from '$lib/shared/components/GeneralButtonMajor.svelte'
  import { getGazePlotterSession } from '$lib/session'
  import { ModalContentMetadataInfo } from '$lib/modals/info/components'
  import GridItemContainer from '$lib/workspace/grid/GridItemContainer.svelte'
  import type {
    WorkspaceCommand,
    WorkspaceCommandChain,
  } from '$lib/workspace/commands'
  import { createRootCommand } from '$lib/workspace/commands'
  import type { AllGridTypes } from '$lib/workspace/type/gridType'

  interface Props {
    onReinitialize: () => void
    onWorkspaceCommand: (
      command: WorkspaceCommand | WorkspaceCommandChain
    ) => void
    initialLayoutState?: Array<Partial<AllGridTypes> & { type: string }> | null
  }

  const {
    onReinitialize,
    onWorkspaceCommand,
    initialLayoutState = null,
  }: Props = $props()
  const { engine, modalState } = getGazePlotterSession()

  /**
   * Determines if the reset layout button should be shown.
   * Valid data means we have loaded actual stimuli and participants.
   */
  const canResetLayout = $derived(engine.hasValidData)

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
      console.warn('Cannot reset layout: no initial layout state provided')
      return
    }

    // Create a setLayoutState command with the initial layout state
    const resetCommand = createRootCommand({
      type: 'setLayoutState',
      layoutState: initialLayoutState,
      source: 'emptyindicator',
    })

    onWorkspaceCommand(resetCommand)
  }
</script>

<div class="empty-workspace-indicator" transition:fade={{ duration: 400 }}>
  <GridItemContainer class="indicator-content">
    {#snippet header()}
      <h3>
        {#if canResetLayout}Workspace Empty{:else}Invalid Data{/if}
      </h3>
    {/snippet}
    {#snippet body()}
      <div class="content-inner">
        <p>
          {#if canResetLayout}
            Data is available in memory, but no visualisations are displayed.
            You can reload the views, upload new data, or explore our sample
            data.
          {:else}
            Data could not be loaded correctly. Please, open the metadata report
            to see the details, upload different data or reload the initial
            data.
          {/if}
        </p>
        <div class="actions">
          {#if canResetLayout}
            <GeneralButtonMajor onclick={handleResetLayout}
              >Reset Layout</GeneralButtonMajor
            >
          {:else}
            <GeneralButtonMajor onclick={openErrorReport}
              >Open Report</GeneralButtonMajor
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
