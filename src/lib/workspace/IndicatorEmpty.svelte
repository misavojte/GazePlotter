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
  // A layout saved with no plots has nothing to return to.
  const hasLayoutToRestore = $derived((ingest.loadedLayout?.length ?? 0) > 0)
  // Emptied by removing the last plots: the likely wish is to have them back.
  const undoRemoval = $derived.by(() => {
    const type = workspace.history.lastUndoCommand?.type
    return type === 'removeGridItem' || type === 'removeGridItems'
      ? workspace.lastUndoLabel
      : null
  })
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
        Visualization{hasLayoutToRestore ? ', reset the layout,' : ''} or upload
        new data.
      {:else}
        Drop eye-tracking files anywhere here, or import them to start.
      {/if}
    </p>
    {#if !fatalLoadError && !canResetLayout}
      <!-- Answers "will my export work?" before the first try. -->
      <p class="formats">
        Tobii Pro Lab, SMI BeGaze, Gazepoint, Varjo, Pupil Cloud, OGAMA, custom
        CSV, or a saved .gazeplotter workspace.
      </p>
    {/if}
    <div class="actions">
      {#if fatalLoadError && canOpenErrorReport}
        <Button onclick={openErrorReport}>Open report</Button>
      {:else if canResetLayout}
        {#if undoRemoval}
          <Button variant="primary" onclick={() => workspace.undo()}>
            {undoRemoval}
          </Button>
        {/if}
        {#if hasLayoutToRestore}
          <Button onclick={handleResetLayout}>Reset layout</Button>
        {/if}
      {/if}
      <!-- The lone first step is the primary one. -->
      <Button
        variant={!fatalLoadError && !canResetLayout ? 'primary' : 'secondary'}
        onclick={onUpload}
      >
        Import workspace or data
      </Button>
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

  /* Pulls up under the message: a footnote to it, not a paragraph of its own. */
  .formats {
    margin-top: -16px;
    color: var(--c-darkgrey);
    font-size: var(--text-sm);
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
</style>
