<script lang="ts">
  import GeneralInputScaffold from '$lib/components/General/GeneralInput/GeneralInputScaffold.svelte'
  interface Props {
    value?: number
    min?: number
    label: string
    oninput?: (event: Event) => void
  }

  let { value = 0, min = 0, label, oninput = () => {} }: Props = $props()

  // Use state instead of bindable
  let inputValue = $state(value)

  // Update inputValue when props value changes
  $effect(() => {
    inputValue = value
  })

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement
    inputValue = target.valueAsNumber

    // Call the oninput callback with the original event
    if (typeof oninput === 'function') {
      oninput(event)
    }
  }

  const id = `text-${label.toLowerCase().replace(/\s+/g, '-')}`
</script>

<GeneralInputScaffold {label} {id}>
  <input {id} type="number" value={inputValue} {min} oninput={handleInput} />
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
  input:out-of-range {
    border-color: var(--c-error);
  }
</style>
