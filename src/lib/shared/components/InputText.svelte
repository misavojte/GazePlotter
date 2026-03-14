<script lang="ts">
  import InputScaffold from './InputScaffold.svelte'
  import { untrack } from 'svelte'
  interface Props {
    value?: string
    label: string
    appearance?: 'default' | 'selectMatched'
    placeholder?: string
    oninput?: (event: CustomEvent) => void
  }

  let {
    value = $bindable(''),
    label,
    appearance = 'default',
    placeholder,
    oninput = () => {},
  }: Props = $props()

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement
    value = target.value
    oninput(new CustomEvent('input', { detail: value }))
  }

  const id = `text-${untrack(() => label.toLowerCase().replace(/\s+/g, '-'))}`
</script>

<InputScaffold
  {label}
  {id}
>
  <input
    {id}
    type="text"
    class:select-matched={appearance === 'selectMatched'}
    bind:value
    oninput={handleInput}
    {placeholder}
  />
</InputScaffold>

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
</style>
