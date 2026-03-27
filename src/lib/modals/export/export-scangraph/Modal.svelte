<script lang="ts">
  import { InputText, Select } from '$lib/shared/components'
  import { Section, ModalButtons } from '$lib/modals'
  import { getStimuliOptions } from '$lib/plots/shared'
  import { getGazePlotterSession } from '$lib/session'
  import {
    createExportButtons,
    waitForExportUi,
  } from '../shared/helpers'

  const { engine, exportService, modalState } = getGazePlotterSession()
  const canReturnToFormats = $derived(modalState.stack.length > 1)
  let fileName = $state('GazePlotter-ScanGraph')
  let stimulusId = $state('0')
  let isExporting = $state(false)

  const stimulusOptions = getStimuliOptions(engine)

  const canExport = $derived(fileName.trim().length > 0)

  const handleExport = async () => {
    if (!canExport) return

    isExporting = true

    try {
      await waitForExportUi()
      await exportService.exportScangraph({
        fileName,
        stimulusId: parseInt(stimulusId),
      })
    } finally {
      isExporting = false
    }
  }

  const exportButtons = $derived(
    createExportButtons({
      canExport,
      exportLabel: 'Export ScanGraph',
      isExporting,
      onCancel: () => modalState.close(),
      onExport: handleExport,
      onOpenFormats: canReturnToFormats ? () => modalState.close() : undefined,
      openFormatsLabel: 'Back to All Data Formats',
    })
  )
</script>

<div class="container">
  <Section>
    <div class="content">
    <p class="purpose-description">
      Export scanpath data for similarity analysis and visualization.
      Compatible with eyetracking.upol.cz/scangraph tool.
    </p>
  </div>
  </Section>

  <Section title="Export Settings">
    <div class="content-two-column">
      <Select
        label="Stimulus"
        options={stimulusOptions}
        bind:value={stimulusId}
      />
      <InputText
        label="File name"
        bind:value={fileName}
        placeholder="Enter filename without extension"
      />
    </div>
  </Section>

  <Section title="Format Details">
    <div class="content">
      <p class="format-description">
        <strong>ScanGraph format</strong> contains scanpath data for the
        selected stimulus, optimized for comparing eye movement patterns between
        participants. Can be directly uploaded to
        <strong>eyetracking.upol.cz/scangraph</strong> for scanpath similarity research.
      </p>
    </div>
  </Section>

  <ModalButtons buttons={exportButtons} />
</div>

<style>
  .container {
    display: flex;
    flex-direction: column;
    max-width: 600px;
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .purpose-description {
    margin: 0;
    color: var(--c-text);
    font-size: 0.95rem;
    line-height: 1.4;
  }

  .content-two-column {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  @media (max-width: 500px) {
    .content-two-column {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }
  }

  .format-description {
    margin: 0;
    color: #666;
    font-size: 0.9rem;
    line-height: 1.4;
  }
</style>
