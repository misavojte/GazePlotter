<script lang="ts">
  import { GeneralInputText, GeneralSelect } from '$lib/shared/components'
  import { SectionHeader, ModalButtons } from '$lib/modals'
  import { getStimuliOptions } from '$lib/plots/shared'
  import { getGazePlotterSession } from '$lib/session'
  import { ModalContentDownloadWorkplace } from '$lib/modals/export/components'
  import {
    createExportButtons,
    waitForExportUi,
  } from './helpers'

  const { engine, exportService, modalState } = getGazePlotterSession()
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
      onOpenFormats: () =>
        modalState.open(
          ModalContentDownloadWorkplace as any,
          'Download Workplace'
        ),
    })
  )
</script>

<div class="container">
  <section class="section">
    <div class="content">
      <p class="purpose-description">
        Export scanpath data for similarity analysis and visualization.
        Compatible with eyetracking.upol.cz/scangraph tool.
      </p>
    </div>
  </section>

  <section class="section">
    <SectionHeader text="Export Settings" />
    <div class="content-two-column">
      <GeneralSelect
        label="Stimulus"
        options={stimulusOptions}
        bind:value={stimulusId}
      />
      <GeneralInputText
        label="File name"
        bind:value={fileName}
        placeholder="Enter filename without extension"
      />
    </div>
  </section>

  <section class="section">
    <SectionHeader text="Format Details" />
    <div class="content">
      <p class="format-description">
        <strong>ScanGraph format</strong> contains scanpath data for the
        selected stimulus, optimized for comparing eye movement patterns between
        participants. Can be directly uploaded to
        <strong>eyetracking.upol.cz/scangraph</strong> for scanpath similarity research.
      </p>
    </div>
  </section>

  <section class="section">
    <ModalButtons buttons={exportButtons} />
  </section>
</div>

<style>
  .container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 600px;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
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
