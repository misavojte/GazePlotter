<script lang="ts">
  import InputScaffold from './InputScaffold.svelte'
  import { untrack } from 'svelte'
  interface Props {
    value?: string
    label: string
    id?: string
    compact?: boolean
    placeholder?: string
    fill?: boolean
    showLabel?: boolean
    disabled?: boolean
    ariaLabel?: string
    oninput?: (event: CustomEvent) => void
  }

  let {
    value = $bindable(''),
    label,
    id,
    compact = false,
    placeholder,
    fill = false,
    showLabel = true,
    disabled = false,
    ariaLabel,
    oninput = () => {},
  }: Props = $props()

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement
    value = target.value
    oninput(new CustomEvent('input', { detail: value }))
  }

  const generatedId = untrack(() => `text-${crypto.randomUUID()}`)
  const inputId = $derived(id ?? generatedId)
</script>

<InputScaffold
  {label}
  id={inputId}
  compact={compact}
  fill={fill || compact}
  {showLabel}
>
  <input
    id={inputId}
    type="text"
    class:compact={compact}
    class:fill
    bind:value
    {disabled}
    aria-label={ariaLabel ?? (!showLabel ? label : undefined)}
    oninput={handleInput}
    {placeholder}
  />
</InputScaffold>

<style>
  input {
    padding: 0.5rem;
    border: 1px solid var(--c-border);
    border-radius: var(--rounded-md);
    font-size: 14px;
    width: 170px;
    box-sizing: border-box;
    margin: 0;
  }

  input.fill {
    width: 100%;
  }

  input.compact {
    width: 100%;
    /* One control height + radius, matching the compact Select trigger and
       InputNumber so stacked/paned fields read as one system. */
    height: 26px;
    padding: 3px 6px;
    border-color: var(--c-midgrey);
    border-radius: var(--rounded);
    font-size: 11px;
    font-weight: 400;
    color: var(--c-black);
    outline: none;
    transition: border-color var(--transition-normal);
  }

  input.compact:focus {
    border-color: var(--c-brand);
  }

  input:disabled {
    background-color: var(--c-lightgrey);
    cursor: not-allowed;
    opacity: 0.7;
  }
</style>
