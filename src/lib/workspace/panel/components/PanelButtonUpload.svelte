<script lang="ts">
  import { ButtonMajor } from '$lib/shared/components'
  import { getGazePlotterSession } from '$lib/session'

  const { ingest } = getGazePlotterSession()
  let isDisabled = $derived(ingest.isLoading)

  let input: HTMLInputElement | undefined = $state()

  const handleFileUpload = async (e: Event) => {
    const files = (e.target as HTMLInputElement).files
    if (!(files instanceof FileList)) return
    if (files.length === 0) return
    await ingest.loadFiles(files)
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

<ButtonMajor {isDisabled} onclick={triggerFileUpload}>
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
</ButtonMajor>

<style>
  label {
    cursor: inherit;
  }
  input {
    display: none;
  }
</style>
