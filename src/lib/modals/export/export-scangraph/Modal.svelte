<script lang="ts">
  import { Select } from '$lib/shared/components'
  import InputRadio from '$lib/shared/components/InputRadio.svelte'
  import { Step, StepList, HelpText } from '$lib/modals'
  import { getStimuliOptions } from '$lib/plots/shared'
  import { getGazePlotterSession } from '$lib/session'
  import ExportShell from '../shared/ExportShell.svelte'

  const { engine, exportService, workspaceFile } = getGazePlotterSession()
  // Named after the dataset, as the workspace and analysis exports are.
  const fileName = `${workspaceFile.suggestedName}-ScanGraph`
  let stimulusId = $state('0')
  let stringForm = $state('original')

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

  const handleExport = () =>
    exportService.exportScangraph({
      fileName,
      stimulusId: parseInt(stimulusId, 10),
      collapsed: stringForm === 'collapsed',
    })
</script>

<ExportShell
  intro="Export scanpath data for similarity analysis and visualization. Compatible with the eyetracking.upol.cz/scangraph tool."
  exportLabel="Export ScanGraph"
  onExport={handleExport}
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
      <InputRadio
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
</ExportShell>
