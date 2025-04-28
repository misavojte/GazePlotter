<script lang="ts">
  import GeneralInputScaffold from '$lib/shared/components/GeneralInputScaffold.svelte'

  interface Props {
    label: string
    files?: FileList | null
    multiple?: boolean
    accept?: string[]
    onchange?: (event: CustomEvent) => void
  }

  let {
    label,
    files = $bindable(null),
    multiple = false,
    accept = [],
    onchange = () => {},
  }: Props = $props()

  function handleChange(event: Event) {
    const target = event.target as HTMLInputElement
    files = target.files
    onchange(new CustomEvent('change', { detail: files }))
  }

  const id = `file-${label.toLowerCase().replace(/\s+/g, '-')}`
</script>

<GeneralInputScaffold {label} {id}>
  <input
    type="file"
    {multiple}
    accept={accept.join(',')}
    onchange={handleChange}
  />
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
