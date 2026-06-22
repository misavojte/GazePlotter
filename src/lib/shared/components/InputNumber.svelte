<script lang="ts">
  import { untrack } from 'svelte'
  import InputScaffold from './InputScaffold.svelte'
  import {
    formatInputNumberValue,
    resolveInputNumberCommit,
  } from './numberInput'

  interface Props {
    value?: number
    min?: number
    max?: number
    label: string
    appearance?: 'default' | 'selectMatched' | 'compact'
    onValueChange?: (value: number | undefined) => void
    disabled?: boolean
    step?: number | string
    placeholder?: string
    allowEmpty?: boolean
    /** Multi-selection "Mixed": the bound plots disagree on this field. Shows an
     *  empty field with a "Mixed" placeholder; typing a value commits it (and
     *  resolves the divergence across the set). */
    mixed?: boolean
    id?: string
  }

  let {
    value = $bindable(),
    min = 0,
    max,
    label,
    appearance = 'default',
    onValueChange = () => {},
    disabled = false,
    step = 1,
    placeholder,
    allowEmpty = false,
    mixed = false,
    id,
  }: Props = $props()

  // Initial only; the $effect below keeps it in sync with `value`/`mixed`.
  let inputValue = $state(
    untrack(() => (mixed ? '' : formatInputNumberValue(value)))
  )
  let isFocused = $state(false)

  function commitValue(nextValue: number | undefined) {
    value = nextValue
    onValueChange(nextValue)
  }

  function handleInput(event: Event) {
    const target = event.currentTarget as HTMLInputElement
    inputValue = target.value
    const nextCommit = resolveInputNumberCommit(target.value, allowEmpty)

    if (nextCommit.shouldCommit && nextCommit.value !== value) {
      commitValue(nextCommit.value)
    }
  }

  function handleFocus() {
    isFocused = true
  }

  function handleBlur() {
    isFocused = false
    inputValue = mixed ? '' : formatInputNumberValue(value)
  }

  $effect(() => {
    const nextValue = mixed ? '' : formatInputNumberValue(value)

    if (!isFocused && inputValue !== nextValue) {
      inputValue = nextValue
    }
  })

  const isCompact = $derived(appearance === 'compact')
  const isSelectMatched = $derived(appearance === 'selectMatched')
  const generatedId = $derived(`number-${label.toLowerCase().replace(/\s+/g, '-')}`)
  const inputId = $derived(id ?? generatedId)
</script>

<InputScaffold
  {label}
  id={inputId}
  compact={isCompact}
  fill={isCompact}
  labelSize={isCompact ? 'compact' : 'default'}
>
  <input
    id={inputId}
    type="number"
    class:select-matched={isSelectMatched}
    class:compact={isCompact}
    {min}
    {max}
    {disabled}
    {step}
    placeholder={mixed ? 'Mixed' : placeholder}
    oninput={handleInput}
    onfocus={handleFocus}
    onblur={handleBlur}
    value={inputValue}
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

  input.select-matched,
  input.compact {
    border-color: var(--c-midgrey);
    color: var(--c-black);
    font-weight: 400;
  }

  input.select-matched {
    height: 34px;
    padding: 0.25em 0.5em;
    border-radius: var(--rounded-md);
    font-size: 13px;
  }

  input.compact {
    width: 100%;
    padding: 3px 6px;
    border-radius: var(--rounded);
    font-size: 11px;
    outline: none;
    transition: border-color var(--transition-normal);
  }

  input.compact:focus {
    border-color: var(--c-brand);
  }

  input.select-matched:focus-visible {
    outline: 2px solid var(--c-brand);
    outline-offset: 2px;
  }

  input:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
    opacity: 0.7;
  }
</style>
