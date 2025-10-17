<script lang="ts">
  import { GeneralButtonMajor } from '$lib/shared/components'
  import { EyeWorkerService } from '$lib/gaze-data/front-process/class/EyeWorkerService'
  import type { DataType } from '$lib/gaze-data/shared/types'
  import {
    processingFileStateStore,
    initializeGridStateStore,
    fileMetadataStore,
    currentFileInputStore,
  } from '$lib/workspace'
  import { setData } from '$lib/gaze-data/front-process/stores/dataStore'
  import { addErrorToast, addSuccessToast } from '$lib/toaster'
  import type { AllGridTypes } from '$lib/workspace/type/gridType'
  import type {
    FileInputType,
    FileMetadataType,
  } from '$lib/workspace/type/fileMetadataType'
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
    fileMetadata?: FileMetadataType
    current: FileInputType
  }) => {
    if (data.fileMetadata) {
      fileMetadataStore.set(data.fileMetadata)
    } else {
      fileMetadataStore.set(null)
    }
    setData(data.data)
    initializeGridStateStore(data.gridItems)
    processingFileStateStore.set('done')
    currentFileInputStore.set(data.current)
  }

  const handleFail = () => {
    addErrorToast('Data processing failed')
    // Reset workspace state to empty so the empty indicator (with reload button) is shown
    initializeGridStateStore([])
    fileMetadataStore.set(null)
    currentFileInputStore.set(null)
    // Set data store to an empty structure so hasValidData returns false
    // This ensures the "Reset Layout" button is disabled when there's no valid data
    setData({
      isOrdinalOnly: false,
      stimuli: { data: [], orderVector: [] },
      participants: { data: [], orderVector: [] },
      participantsGroups: [],
      categories: { data: [], orderVector: [] },
      aois: { data: [], orderVector: [], dynamicVisibility: {} },
      segments: [],
    })
    processingFileStateStore.set('fail')
  }
</script>

<GeneralButtonMajor {isDisabled} onclick={triggerFileUpload}>
  <label for="GP-file-upload">
    Import workspace or data
    <input
      type="file"
      name="GP-file-upload"
      multiple
      accept=".csv, .txt, .tsv, .json, .zip"
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
