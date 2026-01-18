<script lang="ts">
  import { GeneralButtonMajor } from '$lib/shared/components'
  import { EyeWorkerService } from '$lib/gaze-data/front-process/class/EyeWorkerService'
  import type { DataType } from '$lib/gaze-data/shared/types'
  import {
    processingFileStateStore,
    initializeGridStateStore,
    fileMetadataStore,
    currentFileInputStore,
    clear,
  } from '$lib/workspace'
  import { setData } from '$lib/gaze-data/front-process/stores/dataStore'
  import { addErrorToast } from '$lib/toaster'
  import type { AllGridTypes } from '$lib/workspace/type/gridType'
  import type {
    FileInputType,
    FileMetadataType,
    FileMetadataFailureType,
  } from '$lib/workspace/type/fileMetadataType'
  import { grid } from '$lib/workspace/grid'
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
    clear()
    processingFileStateStore.set('done')
    currentFileInputStore.set(data.current)
  }

  /**
   * Handles file processing failures by storing failure metadata.
   * This preserves information about what files were attempted and why they failed,
   * which can be useful for debugging and user support.
   *
   * @param failureMetadata - Complete failure information including error details
   */
  const handleFail = (failureMetadata: FileMetadataFailureType) => {
    addErrorToast('Data processing failed')

    // Reset workspace to empty layout
    grid.reset([])

    fileMetadataStore.set(failureMetadata)
    currentFileInputStore.set({
      fileNames: failureMetadata.fileNames,
      fileSizes: failureMetadata.fileSizes,
      parseDate: failureMetadata.parseDate,
    })

    setData({
      isOrdinalOnly: false,
      stimuli: { data: [], orderVector: [] },
      participants: { data: [], orderVector: [] },
      participantsGroups: [],
      categories: { data: [], orderVector: [] },
      noAoiTreatment: {
        color: '#CCCCCC',
        displayedName: 'No AOI',
      },
      aois: {
        data: [],
        orderVector: [],
        dynamicVisibility: {},
        hiddenAois: [],
      },
      segments: {
        segmentBuffer: new Float32Array(0),
        indexTable: new Uint32Array(0),
        aoiPool: new Uint16Array(0),
        groupMap: new Uint16Array(0),
        // FIX: Add missing metadata properties required by the interface
        maxParticipants: 0,
        stimuliCount: 0,
      },
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
