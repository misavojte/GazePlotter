<script lang="ts">
  import { Select } from '$lib/shared/components'
  import { ModalButtons, Step, StepList, HelpText } from '$lib/modals'
  import { getStimuliOptions } from '$lib/plots/shared'
  import { getGazePlotterSession } from '$lib/session'
  import { createExportButtons, waitForExportUi } from '../shared/helpers'
  import ExportShell from '../shared/ExportShell.svelte'

  const { engine, exportService, modalState } = getGazePlotterSession()
  const fileName = 'GazePlotter-ScanGraph'
  let stimulusId = $state('0')
  let isExporting = $state(false)

  const stimulusOptions = getStimuliOptions(engine)

  const stimulusSummary = $derived(
    stimulusOptions.find(o => o.value === stimulusId)?.label ?? ''
  )

  const handleExport = async () => {
    isExporting = true

    try {
      await waitForExportUi()
      await exportService.exportScangraph({
        fileName,
        stimulusId: parseInt(stimulusId, 10),
      })
    } finally {
      isExporting = false
    }
  }

  const exportButtons = $derived(
    createExportButtons({
      canExport: true,
      exportLabel: 'Export ScanGraph',
      isExporting,
      onCancel: () => modalState.close(),
      onExport: handleExport,
    })
  )
</script>

<ExportShell
  intro="Export scanpath data for similarity analysis and visualization. Compatible with the eyetracking.upol.cz/scangraph tool."
>
  <StepList>
    <Step
      n={1}
      title="Choose stimulus"
      description="A ScanGraph file covers one stimulus."
      summary={stimulusSummary}
      done={true}
      last
    >
      <Select
        label="Stimulus"
        options={stimulusOptions}
        bind:value={stimulusId}
      />
      <HelpText>
        The ScanGraph format contains scanpath data for the selected stimulus,
        optimized for comparing eye movement patterns between participants. It
        can be uploaded directly to eyetracking.upol.cz/scangraph for scanpath
        similarity research.
      </HelpText>
    </Step>
  </StepList>

  <ModalButtons buttons={exportButtons} />
</ExportShell>
