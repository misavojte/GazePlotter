<script lang="ts">
  import ChevronDown from 'lucide-svelte/icons/chevron-down'

  interface Props {
    options: readonly { value: string; label: string }[]
    disabled?: boolean
    label: string
    value?: string
    compact?: boolean
    onchange?: (event: CustomEvent) => void
  }

  let {
    options,
    disabled = false,
    label,
    value = $bindable(options[0]?.value || ''),
    compact = false,
    onchange = () => {},
  }: Props = $props()

  const name = label.toLowerCase().replace(/ /g, '-')

  const handleChange = (e: Event) => {
    const target = e.target as HTMLSelectElement
    value = target.value

    // Call the onchange callback with the new value
    onchange(new CustomEvent('change', { detail: value }))
  }
</script>

<div class="select-wrapper" class:compact>
  <label for={name}>{label}</label>
  <div class="option-wrapper">
    <select {disabled} {name} id="GP-{name}" onchange={handleChange}>
      {#each options as option}
        <option value={option.value} selected={option.value === value}
          >{option.label}</option
        >
      {/each}
    </select>
    <div class="svg-wrap">
      <ChevronDown strokeWidth={1} />
    </div>
  </div>
</div>

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
    background: inherit;
    padding-inline: 4px;
    left: 10px;
    top: -0.9em;
    z-index: 2;
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
    transition: all 0.15s ease-out;
    &:has(select:focus) {
      border-color: var(--c-primary, #1976d2);
      box-shadow: 0 0 0 1px var(--c-primary-light, rgba(25, 118, 210, 0.2));
    }
    &:has(select:disabled) {
      border-color: var(--c-grey);
      background-color: var(--c-lightgrey, #f5f5f5);
    }
    &:hover:not(:has(select:disabled)) {
      border-color: var(--c-black, #333);
    }
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
    transition: all 0.15s ease-out;
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
    transition: transform 0.2s ease;
  }

  .option-wrapper:has(select:focus) .svg-wrap {
    transform: rotate(180deg);
    color: var(--c-primary, #1976d2);
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
</style>
