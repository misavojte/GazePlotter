<script lang="ts">
  import GeneralInputScaffold from '$lib/components/General/GeneralInput/GeneralInputScaffold.svelte'

  export let label: string
  export let files: FileList | null = null
  export let multiple = false
  export let accept: string[] =
    [] /* e.g. ['image/*', '.pdf'], if empty, allows all */

  const id = `file-${label.toLowerCase().replace(/\s+/g, '-')}`
</script>

<GeneralInputScaffold {label} {id}>
  <input type="file" {multiple} accept={accept.join(',')} bind:files />
</GeneralInputScaffold>

<style>
  input[type='file'] {
    cursor: pointer;
  }
  input::file-selector-button {
    border-radius: var(--rounded-lg);
    padding: 0.75em 1.5em;
    background: var(--c-lightgrey);
    border: none;
    font-weight: 600;
    color: var(--c-black);
  }
</style>
