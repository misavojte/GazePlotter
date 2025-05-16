<script lang="ts">
  import { GeneralButtonMajor } from '$lib/shared/components'
  import { EyeWorkerService } from '$lib/gaze-data/front-process/class/EyeWorkerService'
  import type { DataType } from '$lib/gaze-data/shared/types'
  import {
    processingFileStateStore,
    initializeGridStateStore,
  } from '$lib/workspace'
  import { setData } from '$lib/gaze-data/front-process/stores/dataStore'
  import { addErrorToast, addSuccessToast } from '$lib/toaster'
  import type { AllGridTypes } from '$lib/workspace/type/gridType'
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

  const handleEyeData = (data: {
    data: DataType
    gridItems?: Array<Partial<AllGridTypes> & { type: string }>
  }) => {
    setData(data.data)
    addSuccessToast('Data loaded')
    console.log('gridItems', data.gridItems)
    initializeGridStateStore(data.gridItems)
    processingFileStateStore.set('done')
  }

  const handleFail = () => {
    addErrorToast('Data processing failed')
    processingFileStateStore.set('fail')
  }
</script>

<GeneralButtonMajor {isDisabled} onclick={triggerFileUpload}>
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
</GeneralButtonMajor>

<style>
  label {
    cursor: inherit;
  }
  input {
    display: none;
  }
</style>
