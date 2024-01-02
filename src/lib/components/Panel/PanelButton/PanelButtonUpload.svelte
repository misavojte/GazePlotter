<script lang="ts">
   import MajorControlButton from '../../General/GeneralButton/GeneralButtonMajor.svelte'
   import { EyeWorkerService } from '$lib/class/WorkerService/EyeWorkerService.js'
   import type { DataType } from '$lib/type/Data/DataType.js'
   import { processingFileStateStore } from '$lib/stores/processingFileStateStore.js'
   import { setData } from '$lib/stores/dataStore.js'

    let input: HTMLInputElement
    let workerService: EyeWorkerService | null = null

    const handleFileUpload = async (e: Event) => {
      const files = (e.target as HTMLInputElement).files
      if (!(files instanceof FileList)) return
      if (files.length === 0) return
      processingFileStateStore.set('processing')
      workerService = new EyeWorkerService(handleEyeData)
      workerService.sendFiles(files)
    }
    const triggerFileUpload = () => {
      input.click()
    }

    const handleEyeData = (data: DataType) => {
      processingFileStateStore.set('done')
      setData(data)
    }

</script>

<MajorControlButton on:click={triggerFileUpload}>
    <label for="GP-file-upload">
        Upload file
        <input type="file" name="GP-file-upload" multiple accept=".csv, .txt, .tsv, .json" on:change={handleFileUpload} bind:this={input}/>
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
