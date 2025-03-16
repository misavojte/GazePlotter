<script lang="ts">
  import ChevronDown from 'lucide-svelte/icons/chevron-down'

  interface Props {
    options: Array<{ value: string; label: string }>
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
    value = options[0]?.value || '',
    compact = false,
    onchange = () => {},
  }: Props = $props()

  // Convert to state
  let selectedValue = $state(value)

  // Update selectedValue when props value changes
  $effect(() => {
    selectedValue = value
  })

  const name = label.toLowerCase().replace(/ /g, '-')

  const handleChange = (e: Event) => {
    const target = e.target as HTMLSelectElement
    selectedValue = target.value

    // Call the onchange callback with the new value
    onchange(new CustomEvent('change', { detail: selectedValue }))
  }
</script>

<div class="select-wrapper" class:compact>
  <label for={name}>{label}</label>
  <div class="option-wrapper">
    <select {disabled} {name} id="GP-{name}" onchange={handleChange}>
      {#each options as option}
        <option value={option.value} selected={option.value === selectedValue}
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
    margin-bottom: 4px;
    font-size: 14px;
    color: var(--c-black, #333);
    font-weight: 500;
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
  button,
  input,
  select,
  a {
    transition: all 0.15s ease-out;
  }

  /* For GeneralButtonMajor/Minor */
  .button {
    border-radius: var(--rounded, 4px);
    padding: 8px 16px;
    font-weight: 500;
    font-size: 14px;
    border: 1px solid transparent;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    line-height: 1.4;
    position: relative;
    overflow: hidden;
  }

  /* Primary button */
  .button-primary {
    background-color: var(--c-primary, #1976d2);
    color: white;
  }

  .button-primary:hover {
    background-color: var(--c-primary-dark, #1565c0);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  /* Secondary button */
  .button-secondary {
    background-color: transparent;
    border: 1px solid var(--c-darkgrey, #757575);
    color: var(--c-darkgrey, #757575);
  }

  .button-secondary:hover {
    border-color: var(--c-black, #333);
    color: var(--c-black, #333);
    background-color: rgba(0, 0, 0, 0.03);
  }

  /* Disabled state */
  .button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    pointer-events: none;
  }

  /* For GeneralInput variants */
  .input-container {
    position: relative;
    margin-bottom: 16px;
    width: 100%;
  }

  .input-field {
    width: 100%;
    padding: 8px 12px;
    font-size: 14px;
    border: 1px solid var(--c-darkgrey, #757575);
    border-radius: var(--rounded, 4px);
    background-color: white;
    transition: all 0.15s ease-out;
  }

  .input-field:hover:not(:disabled) {
    border-color: var(--c-black, #333);
  }

  .input-field:focus {
    border-color: var(--c-primary, #1976d2);
    box-shadow: 0 0 0 1px var(--c-primary-light, rgba(25, 118, 210, 0.2));
  }

  .input-field:disabled {
    background-color: var(--c-lightgrey, #f5f5f5);
    color: var(--c-darkgrey, #757575);
    cursor: not-allowed;
  }

  /* Input label */
  .input-label {
    display: block;
    margin-bottom: 4px;
    font-size: 14px;
    font-weight: 500;
    color: var(--c-black, #333);
  }

  /* For GeneralEmpty component */
  .empty-state {
    padding: 32px;
    text-align: center;
    background-color: var(--c-lightgrey, #f5f5f5);
    border-radius: var(--rounded-lg, 8px);
    border: 1px dashed var(--c-grey, #e0e0e0);
  }

  .empty-state-icon {
    color: var(--c-darkgrey, #757575);
    margin-bottom: 16px;
  }

  .empty-state-title {
    font-size: 16px;
    font-weight: 500;
    color: var(--c-black, #333);
    margin-bottom: 8px;
  }

  .empty-state-text {
    font-size: 14px;
    color: var(--c-darkgrey, #757575);
    max-width: 300px;
    margin: 0 auto;
  }

  /* For GeneralRadio component */
  .radio-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .radio-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    padding: 4px 0;
  }

  .radio-input {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border: 2px solid var(--c-darkgrey, #757575);
    border-radius: 50%;
    margin: 0;
    display: grid;
    place-content: center;
  }

  .radio-input::before {
    content: '';
    width: 10px;
    height: 10px;
    border-radius: 50%;
    transform: scale(0);
    transition: transform 0.15s ease-in-out;
    box-shadow: inset 10px 10px var(--c-primary, #1976d2);
  }

  .radio-input:checked {
    border-color: var(--c-primary, #1976d2);
  }

  .radio-input:checked::before {
    transform: scale(1);
  }

  .radio-input:focus-visible {
    outline: 2px solid var(--c-primary-light, rgba(25, 118, 210, 0.3));
    outline-offset: 2px;
  }

  .radio-text {
    font-size: 14px;
  }

  /* For GeneralFieldset component */
  .fieldset {
    border: 1px solid var(--c-grey, #e0e0e0);
    border-radius: var(--rounded, 4px);
    padding: 16px;
    margin-bottom: 16px;
    background-color: var(--c-white, white);
  }

  .fieldset-legend {
    padding: 0 8px;
    font-weight: 500;
    font-size: 14px;
    color: var(--c-darkgrey, #757575);
  }

  .fieldset:focus-within {
    border-color: var(--c-primary, #1976d2);
  }

  /* For GeneralPositionControl component */
  .position-control {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .position-button {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--c-white, white);
    border: 1px solid var(--c-grey, #e0e0e0);
    border-radius: var(--rounded, 4px);
    color: var(--c-darkgrey, #757575);
    transition: all 0.15s ease-out;
  }

  .position-button:hover {
    background-color: var(--c-lightgrey, #f5f5f5);
    border-color: var(--c-darkgrey, #757575);
  }

  .position-button.active {
    background-color: var(--c-primary, #1976d2);
    color: white;
    border-color: var(--c-primary, #1976d2);
  }
</style>
