<script lang="ts">
  import Button from '$lib/shared/components/Button.svelte'
  import { getGazePlotterSession } from '$lib/session'
  import { metadataInfoModal } from '$lib/modals/definitions'
  import type { GridItemSnapshot } from '$lib/workspace'
  import IndicatorCard from './IndicatorCard.svelte'

  interface Props {
    initialLayoutState?: GridItemSnapshot[] | null
    onUpload: () => void
  }

  const { initialLayoutState = null, onUpload }: Props = $props()
  const { engine, errorService, ingest, modalState, workspace } =
    getGazePlotterSession()

  const canResetLayout = $derived(engine.hasValidData)
  const fatalLoadError = $derived(errorService.fatalLoad)
  const canOpenErrorReport = $derived(
    fatalLoadError !== null || ingest.metadata !== null
  )

  const cardTitle = $derived(
    fatalLoadError
      ? 'Data Load Failed'
      : canResetLayout
        ? 'Workspace Empty'
        : 'No Data Loaded'
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

<IndicatorCard title={cardTitle}>
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
        <Button onclick={openErrorReport}>Open Report</Button>
      {:else if canResetLayout}
        <Button onclick={handleResetLayout}>Reset Layout</Button>
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
</style>
