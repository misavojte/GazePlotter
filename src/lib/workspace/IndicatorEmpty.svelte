<script lang="ts">
  import Button from '$lib/shared/components/Button.svelte'
  import { getGazePlotterSession } from '$lib/session'
  import { metadataInfoModal } from '$lib/modals/definitions'
  import IndicatorCard from './IndicatorCard.svelte'

  interface Props {
    onUpload: () => void
  }

  const { onUpload }: Props = $props()
  const { engine, errorService, ingest, modalState, workspace } =
    getGazePlotterSession()

  const canResetLayout = $derived(engine.hasValidData)
  const fatalLoadError = $derived(errorService.fatalLoad)
  // Parser messages often lack a final period; the next sentence follows it.
  const fatalSentence = $derived.by(() => {
    const text = fatalLoadError?.userMessage.trim() ?? ''
    return /[.!?]$/.test(text) ? text : `${text}.`
  })
  const canOpenErrorReport = $derived(
    fatalLoadError !== null || ingest.metadata !== null
  )

  const cardTitle = $derived(
    fatalLoadError
      ? 'Data load failed'
      : canResetLayout
        ? 'Workspace empty'
        : 'No data loaded'
  )

  const openErrorReport = () => {
    modalState.open(metadataInfoModal, {})
  }

  const handleResetLayout = () => {
    workspace.resetLayoutGuarded(ingest.loadedLayout, 'IndicatorEmpty')
  }
</script>

<IndicatorCard title={cardTitle}>
  <div class="content-inner">
    <p>
      {#if fatalLoadError}
        {fatalSentence} You can inspect the report or upload different data.
      {:else if canResetLayout}
        Data is loaded, but no plots are shown. Add one with Add
        Visualization, reset the layout, or upload new data.
      {:else}
        Drop eye-tracking files anywhere here, or import them to start.
      {/if}
    </p>
    <div class="actions">
      {#if fatalLoadError && canOpenErrorReport}
        <Button onclick={openErrorReport}>Open report</Button>
      {:else if canResetLayout}
        <Button onclick={handleResetLayout}>Reset layout</Button>
      {/if}
      <Button onclick={onUpload}>Import workspace or data</Button>
    </div>
  </div>
</IndicatorCard>

<style>
  .content-inner {
    text-align: left;
  }

  p {
    margin: 0 0 24px 0;
    color: var(--c-black);
    line-height: var(--leading-relaxed);
    font-size: var(--text-lg);
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
</style>
