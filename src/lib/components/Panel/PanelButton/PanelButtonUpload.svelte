<script lang="ts">
  import MajorControlButton from '$lib/components/General/GeneralButton/GeneralButtonMajor.svelte'
  import { EyeWorkerService } from '$lib/class/WorkerService/EyeWorkerService.ts'
  import type { DataType } from '$lib/type/Data/DataType.ts'
  import { processingFileStateStore } from '$lib/stores/processingFileStateStore.ts'
  import { setData } from '$lib/stores/dataStore.ts'
  import {
    scarfPlotStates,
    setDefaultScarfPlotState,
  } from '$lib/stores/scarfPlotsStore.ts'
  import { addErrorToast, addSuccessToast } from '$lib/stores/toastStore.ts'

  $: isDisabled = $processingFileStateStore === 'processing'

  let input: HTMLInputElement
  let workerService: EyeWorkerService | null = null

  const handleFileUpload = async (e: Event) => {
    const files = (e.target as HTMLInputElement).files
    if (!(files instanceof FileList)) return
    if (files.length === 0) return
    scarfPlotStates.set([])
    processingFileStateStore.set('processing')
    try {
      workerService = new EyeWorkerService(handleEyeData)
      workerService.sendFiles(files)
    } catch (e) {
      console.error(e)
      addErrorToast('Unable to set up file processing service')
    }
    input.value = ''
  }
  const triggerFileUpload = () => {
    input.click()
  }

  const handleEyeData = (data: DataType) => {
    addSuccessToast('Data loaded')
    processingFileStateStore.set('done')
    setData(data)
    setDefaultScarfPlotState()
  }
</script>

<MajorControlButton {isDisabled} on:click={triggerFileUpload}>
  <label for="GP-file-upload">
    Upload file
    <input
      type="file"
      name="GP-file-upload"
      multiple
      accept=".csv, .txt, .tsv, .json"
      on:change={handleFileUpload}
      bind:this={input}
    />
  </label>
</MajorControlButton>

<style>
  label {
    cursor: inherit;
  }
  input {
    display: none;
  }
</style>
