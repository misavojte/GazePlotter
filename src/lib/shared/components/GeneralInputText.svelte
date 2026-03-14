<script lang="ts">
  import GeneralInputScaffold from '$lib/shared/components/GeneralInputScaffold.svelte'
  interface Props {
    value?: string
    label: string
    id?: string
    appearance?: 'default' | 'selectMatched'
    fullWidth?: boolean
    compact?: boolean
    placeholder?: string
    oninput?: (event: CustomEvent) => void
  }

  let {
    value = $bindable(''),
    label,
    id: providedId,
    appearance = 'default',
    fullWidth = false,
    compact = false,
    placeholder,
    oninput = () => {},
  }: Props = $props()

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement
    value = target.value
    oninput(new CustomEvent('input', { detail: value }))
  }

  const inputId = $derived(
    providedId ?? `text-${label.toLowerCase().replace(/\s+/g, '-')}`
  )
</script>

<GeneralInputScaffold
  {label}
  id={inputId}
  {compact}
>
  <input
    id={inputId}
    type="text"
    class:fullWidth
    class:select-matched={appearance === 'selectMatched'}
    bind:value
    oninput={handleInput}
    {placeholder}
  />
</GeneralInputScaffold>

<style>
  input {
    padding: 0.5rem;
    border: 1px solid var(--c-border);
    border-radius: var(--rounded);
    font-size: 14px;
    width: 170px;
    max-width: 100%;
    box-sizing: border-box;
  }

  input.fullWidth {
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
</style>
