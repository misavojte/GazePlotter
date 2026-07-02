<script lang="ts">
  import { InputText, Select } from '$lib/shared/components'
  import { ModalButtons, Step, StepList, HelpText } from '$lib/modals'
  import { getStimuliOptions } from '$lib/plots/shared'
  import { getGazePlotterSession } from '$lib/session'
  import { createExportButtons, waitForExportUi } from '../shared/helpers'
  import ExportShell from '../shared/ExportShell.svelte'

  const { engine, exportService, modalState } = getGazePlotterSession()
  let fileName = $state('GazePlotter-ScanGraph')
  let stimulusId = $state('0')
  let isExporting = $state(false)

  const stimulusOptions = getStimuliOptions(engine)

  const stimulusSummary = $derived(
    stimulusOptions.find(o => o.value === stimulusId)?.label ?? ''
  )

  const stepFileDone = $derived(fileName.trim().length > 0)
  const canExport = $derived(stepFileDone)

  const handleExport = async () => {
    if (!canExport) return

    isExporting = true

    try {
      await waitForExportUi()
      await exportService.exportScangraph({
        fileName: fileName.trim(),
        stimulusId: parseInt(stimulusId, 10),
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
    >
      <Select
        label="Stimulus"
        options={stimulusOptions}
        bind:value={stimulusId}
      />
    </Step>

    <Step
      n={2}
      title="Configure the file"
      summary={stepFileDone ? `${fileName.trim()}.txt` : 'File name missing'}
      done={stepFileDone}
      last
    >
      <InputText
        label="File name"
        bind:value={fileName}
        placeholder="Enter filename without extension"
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
