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
    compact?: boolean
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
    /** Fires after focus leaves the input (the typed draft stops displaying). */
    onBlur?: () => void
  }

  let {
    value = $bindable(),
    min = 0,
    max,
    label,
    compact = false,
    onValueChange = () => {},
    disabled = false,
    step = 1,
    placeholder,
    allowEmpty = false,
    mixed = false,
    id,
    onBlur,
  }: Props = $props()

  let inputValue = $state('')
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
    inputValue = mixed ? '' : formatInputNumberValue(value)
  }

  function handleBlur() {
    isFocused = false
    onBlur?.()
  }

  const generatedId = untrack(() => `number-${crypto.randomUUID()}`)
  const inputId = $derived(id ?? generatedId)
</script>

<InputScaffold
  {label}
  id={inputId}
  compact={compact}
  fill={compact}
>
  <input
    id={inputId}
    type="number"
    class:compact={compact}
    {min}
    {max}
    {disabled}
    {step}
    placeholder={mixed ? 'Mixed' : placeholder}
    oninput={handleInput}
    onfocus={handleFocus}
    onblur={handleBlur}
    value={isFocused ? inputValue : (mixed ? '' : formatInputNumberValue(value))}
  />
</InputScaffold>

<style>
  input {
    height: 34px;
    padding: 0.25em 0.5em;
    border: 1px solid var(--c-midgrey);
    border-radius: var(--rounded-md);
    font-size: 13px;
    font-weight: 400;
    color: var(--c-black);
    width: 170px;
    box-sizing: border-box;
  }

  input:focus-visible {
    outline: 2px solid var(--c-brand);
    outline-offset: 2px;
  }

  input.compact {
    width: 100%;
    /* Matches the compact Select trigger: one control height + radius so
       pane rows read as one system. */
    height: 26px;
    padding: 3px 6px;
    border-radius: var(--rounded);
    font-size: 11px;
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
