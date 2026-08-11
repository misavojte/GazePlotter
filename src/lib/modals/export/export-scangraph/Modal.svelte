<script lang="ts">
  import { Select } from '$lib/shared/components'
  import Radio from '$lib/shared/components/Radio.svelte'
  import { ModalButtons, Step, StepList, HelpText } from '$lib/modals'
  import { getStimuliOptions } from '$lib/plots/shared'
  import { getGazePlotterSession } from '$lib/session'
  import { createExportButtons, withExportBusy } from '../shared/helpers'
  import ExportShell from '../shared/ExportShell.svelte'

  const { engine, exportService, modalState } = getGazePlotterSession()
  const fileName = 'GazePlotter-ScanGraph'
  let stimulusId = $state('0')
  let stringForm = $state('original')
  let isExporting = $state(false)

  const stimulusOptions = getStimuliOptions(engine)

  const STRING_FORM_OPTIONS = [
    { value: 'original', label: 'Original (one letter per fixation)' },
    { value: 'collapsed', label: 'Collapsed (consecutive same-AOI fixations folded)' },
  ]

  const stimulusSummary = $derived(
    stimulusOptions.find(o => o.value === stimulusId)?.label ?? ''
  )

  const stringFormSummary = $derived(
    stringForm === 'collapsed' ? 'Collapsed' : 'Original'
  )

  const handleExport = async () => {
    await withExportBusy(
      val => (isExporting = val),
      () =>
        exportService.exportScangraph({
          fileName,
          stimulusId: parseInt(stimulusId, 10),
          collapsed: stringForm === 'collapsed',
        })
    )
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
    <Step
      n={2}
      title="Choose string form"
      description="How fixations become letters."
      summary={stringFormSummary}
      done={true}
      last
    >
      <Radio
        ariaLabel="Scanpath string form"
        options={STRING_FORM_OPTIONS}
        bind:value={stringForm}
      />
      <HelpText>
        Original strings keep one letter per fixation, so dwell duration
        weighs into the comparison. Collapsed strings fold consecutive
        fixations in the same AOI, comparing the order of visited AOIs only.
      </HelpText>
    </Step>
  </StepList>

  <ModalButtons buttons={exportButtons} />
</ExportShell>
