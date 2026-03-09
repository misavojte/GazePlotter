<script lang="ts">
  import { GeneralButtonMajor } from '$lib/shared/components'
  import { getGazePlotterSession } from '$lib/session'

  const { ingest } = getGazePlotterSession()
  let isDisabled = $derived(ingest.isLoading)

  let input: HTMLInputElement | undefined = $state()

  const handleFileUpload = async (e: Event) => {
    const files = (e.target as HTMLInputElement).files
    if (!(files instanceof FileList)) return
    if (files.length === 0) return
    try {
      await ingest.loadFiles(files)
    } catch {
      // IngestService already applies failure state and user feedback.
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
