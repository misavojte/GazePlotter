<script lang="ts">
  import PanelButtonUpload from '$lib/workspace/panel/components/PanelButtonUpload.svelte'
  import { fade } from 'svelte/transition'
  import ButtonMajor from '$lib/shared/components/ButtonMajor.svelte'
  import { getGazePlotterSession } from '$lib/session'
  import { metadataInfoModal } from '$lib/modals/definitions'
  import type { GridItemSnapshot } from '$lib/workspace'

  interface Props {
    initialLayoutState?: GridItemSnapshot[] | null
  }

  const { initialLayoutState = null }: Props = $props()
  const { engine, errorService, ingest, modalState, workspace } =
    getGazePlotterSession()

  const canResetLayout = $derived(engine.hasValidData)
  const fatalLoadError = $derived(errorService.fatalLoad)
  const canOpenErrorReport = $derived(
    fatalLoadError !== null || ingest.metadata !== null
  )

  const openErrorReport = () => {
    modalState.open(metadataInfoModal, {})
  }

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
            {fatalLoadError.userMessage} You can inspect the report or upload different
            data.
          {:else if canResetLayout}
            Data is available in memory, but no visualisations are displayed.
            You can reset the layout or upload new data.
          {:else}
            Upload new data to start working with the workspace.
          {/if}
        </p>
        <div class="actions">
          {#if fatalLoadError && canOpenErrorReport}
            <ButtonMajor onclick={openErrorReport}>Open Report</ButtonMajor>
          {:else if canResetLayout}
            <ButtonMajor onclick={handleResetLayout}>Reset Layout</ButtonMajor>
          {/if}
          <PanelButtonUpload />
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
    border-radius: var(--rounded-lg);
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
