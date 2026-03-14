<script lang="ts">
  import GeneralInputScaffold from '$lib/shared/components/GeneralInputScaffold.svelte'
  import { untrack } from 'svelte'
  interface Props {
    value?: number
    min?: number
    label: string
    appearance?: 'default' | 'selectMatched'
    oninput?: (event: Event) => void
    disabled?: boolean
    step?: number
  }

  let {
    value = $bindable(0),
    min = 0,
    label,
    appearance = 'default',
    oninput = () => {},
    disabled = false,
    step = 1,
  }: Props = $props()

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement
    value = target.valueAsNumber

    // Call the oninput callback with the original event
    if (typeof oninput === 'function') {
      oninput(event)
    }
  }

  const id = `text-${untrack(() => label.toLowerCase().replace(/\s+/g, '-'))}`
</script>

<GeneralInputScaffold
  {label}
  {id}
>
  <input
    {id}
    type="number"
    class:select-matched={appearance === 'selectMatched'}
    bind:value
    {min}
    {disabled}
    {step}
    oninput={handleInput}
  />
</GeneralInputScaffold>

<style>
  input {
    padding: 0.5rem;
    border: 1px solid var(--c-border);
    border-radius: var(--rounded);
    font-size: 14px;
    width: 170px;
    box-sizing: border-box;
  }

  input.select-matched {
    height: 34px;
    padding: 0.25em 0.5em;
    border: 1px solid var(--c-midgrey);
    border-radius: var(--rounded-md);
    font-size: 13px;
    font-weight: 400;
    color: var(--c-black);
  }

  input.select-matched:focus-visible {
    outline: 2px solid var(--c-primary, #1976d2);
    outline-offset: 2px;
  }

  input:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
    opacity: 0.7;
  }
</style>
