<script lang="ts">
  import { getGazePlotterSession } from '$lib/session'
  import { exportWorkspaceModal, metadataInfoModal } from '$lib/modals/definitions'
  import { createRibbonItems } from './config'
  import RibbonItem from './RibbonItem.svelte'

  interface Props {
    onUpload: () => void
  }

  const { onUpload }: Props = $props()
  const { ingest, modalState, errorService } = getGazePlotterSession()

  const isProcessing = $derived(ingest.isLoading)
  const hasFatalError = $derived(errorService.fatalLoad !== null)

  const handleExport = () => {
    modalState.open(exportWorkspaceModal, {})
  }

  const handleOpenMetadata = () => {
    modalState.open(metadataInfoModal, {})
  }

  const ribbonItems = $derived.by(() =>
    createRibbonItems({
      isProcessing,
      hasFatalError,
      onUpload,
      onExport: handleExport,
      onOpenMetadata: handleOpenMetadata,
    })
  )
</script>

<div class="ribbon">
  <div class="ribbon-content">
    {#each ribbonItems as item, i (item.id)}
      {#if i > 0}
        <div class="divider"></div>
      {/if}
      <RibbonItem
        label={item.label}
        shortLabel={item.shortLabel}
        icon={item.icon}
        action={item.action}
        disabled={item.disabled}
      />
    {/each}
  </div>
</div>

<style>
  .ribbon {
    width: 100%;
    height: 48px;
    background-color: var(--c-lightgrey);
    box-sizing: border-box;
    z-index: 2;
    transition: background-color var(--transition-slow) ease;
    font-family: inherit;
  }

  .ribbon-content {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 0 16px;
    gap: 12px;
  }

  .divider {
    width: 1px;
    height: 16px;
    background-color: var(--c-grey);
  }
</style>
