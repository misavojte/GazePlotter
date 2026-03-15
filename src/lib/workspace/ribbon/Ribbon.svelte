<script lang="ts">
  import { getGazePlotterSession } from '$lib/session'
  import { downloadWorkspaceModal, metadataInfoModal } from '$lib/modals/definitions'
  import { createRibbonItems } from './config'
  import RibbonItem from './RibbonItem.svelte'

  const { ingest, modalState } = getGazePlotterSession()

  const isProcessing = $derived(ingest.isLoading)

  // File upload handling (from PanelButtonUpload)
  let fileInput: HTMLInputElement | undefined = $state()

  const handleFileUpload = async (e: Event) => {
    const files = (e.target as HTMLInputElement).files
    if (!(files instanceof FileList)) return
    if (files.length === 0) return
    await ingest.loadFiles(files)
    if (fileInput) {
      fileInput.value = ''
    }
  }

  const triggerFileUpload = () => {
    if (fileInput) {
      fileInput.click()
    }
  }

  const handleExport = () => {
    modalState.open(downloadWorkspaceModal, {})
  }

  const handleOpenMetadata = () => {
    modalState.open(metadataInfoModal, {})
  }

  const ribbonItems = $derived.by(() =>
    createRibbonItems({
      isProcessing,
      onUpload: triggerFileUpload,
      onExport: handleExport,
      onOpenMetadata: handleOpenMetadata,
    })
  )
</script>

<input
  type="file"
  name="GP-ribbon-file-upload"
  class="hidden-file-input"
  multiple
  accept=".csv, .txt, .tsv, .json, .zip"
  onchange={handleFileUpload}
  bind:this={fileInput}
/>

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
  .hidden-file-input {
    display: none;
  }

  .ribbon {
    width: 100%;
    height: 48px;
    background-color: var(--c-lightgrey, #f1f5f9);
    box-sizing: border-box;
    z-index: 2;
    transition: background-color 0.3s ease;
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
    background-color: #e2e8f0;
  }
</style>
