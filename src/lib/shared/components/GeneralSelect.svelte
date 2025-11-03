<script lang="ts">
  import ChevronDown from 'lucide-svelte/icons/chevron-down'

  interface Props {
    options: readonly { value: string; label: string }[]
    disabled?: boolean
    label: string
    value?: string
    compact?: boolean
    onchange?: (event: CustomEvent) => void
    // Group mode props (optional, mirrors GeneralButtonMinor grouping)
    items?: GroupSelectItem[]
    ariaLabel?: string
  }

  export interface GroupSelectItem {
    options: readonly { value: string; label: string }[]
    label: string
    value: string
    disabled?: boolean
    ariaLabel?: string
    onchange?: (event: CustomEvent) => void
  }

  let {
    options,
    disabled = false,
    label,
    value = $bindable(options[0]?.value || ''),
    compact = false,
    onchange = () => {},
    // group
    items,
    ariaLabel,
  }: Props = $props()

  const name = label.toLowerCase().replace(/ /g, '-')

  const handleChange = (e: Event) => {
    const target = e.target as HTMLSelectElement
    value = target.value

    // Call the onchange callback with the new value
    onchange(new CustomEvent('change', { detail: value }))
    // Remove focus after selection
    target.blur()
  }

  // Ensure blur even when selecting the same option by handling second click after focus
  let singleClickArmed = $state(false)
  const handleSingleFocus = () => { singleClickArmed = false }
  const handleSingleClick = (e: MouseEvent) => {
    const target = e.currentTarget as HTMLSelectElement | null
    if (!target) return
    if (!singleClickArmed) {
      // first click arms; allow native open
      singleClickArmed = true
      return
    }
    // subsequent click while focused → blur even if value unchanged
    target.blur()
  }

  // Group helpers
  const itemsSafe = $derived((items ?? []) as GroupSelectItem[])
  const isGroup = $derived(itemsSafe.length > 0)

  const handleItemChange = (idx: number) => (e: Event) => {
    const target = e.target as HTMLSelectElement
    const newValue = target.value
    const item = itemsSafe[idx]
    item?.onchange?.(new CustomEvent('change', { detail: newValue }))
    // Remove focus after selection
    target.blur()
  }

  // Per-item click arming for grouped selects
  let groupClickArmed = $state<boolean[]>([])
  $effect(() => { groupClickArmed = itemsSafe.map(() => false) })
  const handleItemFocus = (idx: number) => () => { groupClickArmed[idx] = false }
  const handleItemClick = (idx: number) => (e: MouseEvent) => {
    const target = e.currentTarget as HTMLSelectElement | null
    if (!target) return
    if (!groupClickArmed[idx]) {
      groupClickArmed[idx] = true
      return
    }
    target.blur()
  }
</script>

{#if !isGroup}
  <div class="select-wrapper" class:compact>
    <label for={name}>{label}</label>
    <div class="option-wrapper">
      <select {disabled} {name} id="GP-{name}" onchange={handleChange} onfocus={handleSingleFocus} onclick={handleSingleClick}>
        {#each options as option}
          <option value={option.value} selected={option.value === value}>{option.label}</option>
        {/each}
      </select>
      <div class="svg-wrap">
        <ChevronDown strokeWidth={1} />
      </div>
    </div>
  </div>
{:else}
  <!-- Group mode: always compact -->
  <div class="selectGroup" role="group" aria-label={ariaLabel}>
    {#each itemsSafe as item, idx}
      <div class="itemWrap" class:first={idx === 0} class:last={idx === itemsSafe.length - 1}>
        <div class="select-wrapper compact">
          <label for={`GP-${name}-${idx}`}>{item.label}</label>
          <div class="option-wrapper">
            <select
              disabled={item.disabled}
              name={`GP-${name}-${idx}`}
              id={`GP-${name}-${idx}`}
              onchange={handleItemChange(idx)}
              onfocus={handleItemFocus(idx)}
              onclick={handleItemClick(idx)}
            >
              {#each item.options as option}
                <option value={option.value} selected={option.value === item.value}>{option.label}</option>
              {/each}
            </select>
            <div class="svg-wrap">
              <ChevronDown strokeWidth={1} />
            </div>
          </div>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .select-wrapper {
    display: flex;
    flex-direction: column;
    position: relative;
    width: 170px;
    margin-bottom: 15px;
    gap: 5px;
    font-family:
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      'Segoe UI',
      Roboto,
      sans-serif;
    /* Track field background for syncing with label */
    --gp-field-bg: var(--c-white);
  }

  .select-wrapper.compact {
    width: 140px;
    margin-bottom: 0;
  }

  .compact {
    background: inherit;
  }

  label {
    font-size: 14px;
    color: var(--c-black);
  }

  .compact label {
    font-size: 8px;
    position: absolute;
    font-weight: 500;
    line-height: 1rem;
    letter-spacing: 0.0333333333em;
    text-transform: uppercase;
    color: var(--c-darkgrey);
    /* Match current field background (synced via CSS variable) */
    background: var(--gp-field-bg);
    border-radius: 8px;
    padding-inline: 6px;
    left: 10px;
    top: -0.9em;
    z-index: 2;
    transition: background-color 0.2s ease, color 0.2s ease;
  }

  /* Keep field background variable in sync with hover/focus/disabled */
  .select-wrapper:has(.option-wrapper:hover),
  .select-wrapper:has(.option-wrapper:focus-within) {
    /* Match Minor button hover background */
    --gp-field-bg: #f6f7f9;
  }

  /* On hover/focus, the label text should also use the brand color */
  .select-wrapper.compact:has(.option-wrapper:hover) label,
  .select-wrapper.compact:has(.option-wrapper:focus-within) label {
    color: var(--c-brand);
  }

  .option-wrapper {
    display: flex;
    align-items: center;
    border-radius: var(--rounded);
    border: 1px solid var(--c-darkgrey);
    position: relative;
    height: 34px;
    overflow: hidden;
    box-sizing: border-box;
    transition: background-color 0.2s ease, color 0.2s ease;
    background: var(--gp-field-bg);
    /* Focus/hover effects via background + color, not border */
    /* background is handled via --gp-field-bg on wrapper when focused */
    &:has(select:focus) { background: var(--gp-field-bg); }
    &:has(select:disabled) {
      border-color: var(--c-grey);
      background-color: var(--c-lightgrey, #f5f5f5);
      /* reflect disabled bg to wrapper var for label sync */
      /* using :has at wrapper to change var when disabled */
    }
    &:hover:not(:has(select:disabled)) { background: var(--gp-field-bg); }
  }

  /* When disabled, sync the wrapper background variable */
  .select-wrapper:has(.option-wrapper:has(select:disabled)) {
    --gp-field-bg: var(--c-lightgrey, #f5f5f5);
  }

  select {
    background: inherit;
    font-weight: 400;
    line-height: 1.5rem;
    letter-spacing: 0.00938em;
    color: var(--c-black);
    border: none;
    font-size: 14px;
    width: 100%;
    height: 100%;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    cursor: pointer;
    padding: 0.25em;
    padding-inline: 0.5em 22px;
    transition: color 0.2s ease, background-color 0.2s ease;
  }

  .compact select {
    background: inherit;
    padding-inline: 14px 22px;
  }

  .svg-wrap {
    position: absolute;
    right: 3px;
    top: 0;
    height: 100%;
    width: 15px;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--c-darkgrey);
    transition: transform 0.2s ease, color 0.2s ease;
  }

  .option-wrapper:has(select:focus) .svg-wrap {
    transform: rotate(180deg);
  }

  /* Change text and chevron color on hover/focus to mimic GeneralButtonMenu */
  .option-wrapper:hover select,
  .option-wrapper:has(select:focus) select {
    color: var(--c-brand);
  }

  .option-wrapper:hover .svg-wrap,
  .option-wrapper:has(select:focus) .svg-wrap {
    color: var(--c-brand);
  }

  select:focus {
    outline: none;
  }

  select:disabled {
    color: var(--c-darkgrey);
    cursor: not-allowed;
  }

  /* Add these consistent styles to all components */
  * {
    box-sizing: border-box;
  }

  /* Consistent focus styles */
  :focus {
    outline: none;
  }

  :focus-visible {
    outline: 2px solid var(--c-primary, #1976d2);
    outline-offset: 2px;
  }

  /* Subtle transitions for interactive elements */
  select {
    transition: all 0.15s ease-out;
  }

  /* Group wrapper and separators (mirrors button group behavior) */
  .selectGroup {
    display: inline-flex;
    gap: 0;
    background: inherit;
    border-radius: var(--rounded);
  }
  .itemWrap { position: relative; }
  .selectGroup .itemWrap:not(.first)::before {
    content: '';
    position: absolute;
    left: 0;
    top: 1px;
    bottom: 1px;
    width: 1px;
    background: var(--c-midgrey);
    opacity: 0.7;
    pointer-events: none;
    z-index: 2;
  }
  /* Remove inner borders and radius so adjacent selects appear merged */
  .selectGroup .itemWrap:not(.first) :global(.option-wrapper) { border-left: none; }
  .selectGroup .itemWrap:not(.last) :global(.option-wrapper) { border-right: none; }
  .selectGroup .itemWrap :global(.option-wrapper) { border-radius: 0; }
  .selectGroup .itemWrap.first :global(.option-wrapper) {
    border-top-left-radius: var(--rounded);
    border-bottom-left-radius: var(--rounded);
  }
  .selectGroup .itemWrap.last :global(.option-wrapper) {
    border-top-right-radius: var(--rounded);
    border-bottom-right-radius: var(--rounded);
  }
</style>

<!--
Usage examples:

<GeneralSelect label="Mode" options={[{ value: 'a', label: 'A' }]} />

<GeneralSelect
  ariaLabel="Filters"
  items=[
    { label: 'A', options: aOpts, value: aVal, onchange: e => aVal = e.detail },
    { label: 'B', options: bOpts, value: bVal, onchange: e => bVal = e.detail }
  ]
/>
-->
