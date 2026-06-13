<script lang="ts">
  import InputScaffold from './InputScaffold.svelte'
  import { untrack } from 'svelte'
  interface Props {
    value?: string
    label: string
    id?: string
    appearance?: 'default' | 'selectMatched' | 'compact'
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
    appearance = 'default',
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
  const isCompact = $derived(appearance === 'compact')
</script>

<InputScaffold
  {label}
  id={inputId}
  compact={isCompact}
  fill={fill || isCompact}
  labelSize={isCompact ? 'compact' : 'default'}
  {showLabel}
>
  <input
    id={inputId}
    type="text"
    class:select-matched={appearance === 'selectMatched'}
    class:compact={isCompact}
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

  input.compact {
    width: 100%;
    padding: 3px 6px;
    border-color: var(--c-midgrey);
    border-radius: var(--rounded, 4px);
    font-size: 11px;
    font-weight: 400;
    color: var(--c-black);
    outline: none;
    transition: border-color 0.2s;
  }

  input.compact:focus {
    border-color: var(--c-brand);
  }

  input:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
    opacity: 0.7;
  }
</style>
