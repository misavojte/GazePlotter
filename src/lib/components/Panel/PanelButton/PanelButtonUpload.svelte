<script lang="ts">
  import MajorControlButton from '$lib/shared/components/GeneralButtonMajor.svelte'
  import { EyeWorkerService } from '$lib/class/WorkerService/EyeWorkerService'
  import type { DataType } from '$lib/type/Data/DataType'
  import { processingFileStateStore } from '$lib/stores/processingFileStateStore'
  import { setData } from '$lib/stores/dataStore'
  import { addErrorToast, addSuccessToast } from '$lib/toaster'

  let isDisabled = $derived($processingFileStateStore === 'processing')

  let input: HTMLInputElement | undefined = $state()
  let workerService: EyeWorkerService | null = null

  const handleFileUpload = async (e: Event) => {
    const files = (e.target as HTMLInputElement).files
    if (!(files instanceof FileList)) return
    if (files.length === 0) return
    processingFileStateStore.set('processing')
    try {
      workerService = new EyeWorkerService(handleEyeData, handleFail)
      workerService.sendFiles(files)
    } catch (e) {
      console.error(e)
      addErrorToast('Unable to set up file processing service')
    }
    if (input) {
      input.value = ''
    }
  }
  const triggerFileUpload = () => {
    if (input) {
      input.click()
    }
  }

  const handleEyeData = (data: DataType) => {
    setData(data)
    addSuccessToast('Data loaded')
    processingFileStateStore.set('done')
  }

  const handleFail = () => {
    addErrorToast('Data processing failed')
    processingFileStateStore.set('fail')
  }
</script>

<MajorControlButton {isDisabled} onclick={triggerFileUpload}>
  <label for="GP-file-upload">
    Upload file
    <input
      type="file"
      name="GP-file-upload"
      multiple
      accept=".csv, .txt, .tsv, .json"
      onchange={handleFileUpload}
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
