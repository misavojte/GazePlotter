<script lang="ts">
  import GeneralInputScaffold from '$lib/components/General/GeneralInput/GeneralInputScaffold.svelte'
  interface Props {
    value?: string
    label: string
    oninput?: (event: CustomEvent) => void
  }

  let { value = '', label, oninput = () => {} }: Props = $props()

  // Use state instead of bindable
  let inputValue = $state(value)

  // Update inputValue when props value changes
  $effect(() => {
    inputValue = value
  })

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement
    inputValue = target.value
    oninput(new CustomEvent('input', { detail: inputValue }))
  }

  const id = `text-${label.toLowerCase().replace(/\s+/g, '-')}`
</script>

<GeneralInputScaffold {label} {id}>
  <input {id} type="text" value={inputValue} oninput={handleInput} />
</GeneralInputScaffold>

<style>
  input {
    padding: 0.5rem;
    border: 1px solid var(--c-darkgrey);
    border-radius: var(--rounded);
    font-size: 14px;
    width: 170px;
    box-sizing: border-box;
  }
</style>
