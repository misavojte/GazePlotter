<script lang="ts">
  import type { Snippet } from 'svelte'
  import { ModalButtons } from '$lib/modals'
  import { getGazePlotterSession } from '$lib/session'
  import { yieldToPaint } from '$lib/data/export/progress'
  import ExportProgressBar from './ExportProgressBar.svelte'

  /**
   * Common frame of every export modal: the stable design width (the modal
   * shell clamps it on smaller viewports, so the dialog never resizes as
   * steps open and close), an optional one-line purpose intro, and the
   * busy-guarded export run with its progress bar and buttons.
   */
  interface Props {
    intro?: string
    canExport?: boolean
    exportLabel?: string
    onExport: () => Promise<unknown>
    /** Replaces the export service's progress (figures report their own). */
    progress?: { position: number; total: number; name: string } | null
    children: Snippet
  }

  let {
    intro = '',
    canExport = true,
    exportLabel = 'Export Data',
    onExport,
    progress,
    children,
  }: Props = $props()
  const { exportService, modalState } = getGazePlotterSession()
  let isExporting = $state(false)

  // One UI tick first, so the "Exporting..." state paints before the work.
  const handleExport = async () => {
    if (!canExport || isExporting) return
    isExporting = true
    try {
      await yieldToPaint()
      await onExport()
    } finally {
      isExporting = false
    }
  }
</script>

<div class="container">
  {#if intro}
    <p class="purpose-description">{intro}</p>
  {/if}
  {@render children()}
  <ExportProgressBar
    progress={progress === undefined ? exportService.progress : progress}
  />
  <ModalButtons
    buttons={[
      {
        label: isExporting ? 'Exporting...' : exportLabel,
        onclick: handleExport,
        isDisabled: !canExport || isExporting,
        variant: 'primary',
      },
      { label: 'Cancel', onclick: () => modalState.close() },
    ]}
  />
</div>

<style>
  .container {
    display: flex;
    flex-direction: column;
    width: 840px;
    max-width: 100%;
  }

  .purpose-description {
    margin: 0 0 16px 0;
    color: var(--c-black);
    font-size: var(--text-xl);
    letter-spacing: -0.01em;
    line-height: var(--leading-normal);
    text-wrap: pretty;
  }
</style>
