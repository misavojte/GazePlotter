<script lang="ts">
  interface Props {
    label: string
    sublabel?: string
    checked?: boolean
    compact?: boolean
    id?: string
    ariaLabel?: string
    disabled?: boolean
    /** Multi-selection "Mixed": the bound plots disagree on this field. Renders
     *  the indeterminate (tri-state) box; the first click resolves it to a
     *  concrete value applied to all. */
    mixed?: boolean
    onchange?: (event: CustomEvent) => void
  }
  import { untrack } from 'svelte'

  let {
    label,
    sublabel,
    checked = $bindable(false),
    compact = false,
    id,
    ariaLabel,
    disabled = false,
    mixed = false,
    onchange = () => {},
  }: Props = $props()

  const generatedId = untrack(() => `check-${crypto.randomUUID()}`)
  const inputId = $derived(id ?? generatedId)

  const hasLabel = $derived(!!label || !!sublabel)

  const displayChecked = $derived(mixed ? false : !!checked)

  function handleChange(event: Event) {
    const target = event.currentTarget as HTMLInputElement
    checked = target.checked
    onchange(new CustomEvent('change', { detail: target.checked }))
  }
</script>

<label class:noLabel={!hasLabel} class:compact={compact} class:disabled>
  <span class="check-wrap" class:size-xs={compact} class:compact={compact}>
    <input
      type="checkbox"
      class="check"
      id={inputId}
      checked={displayChecked}
      indeterminate={mixed}
      aria-label={ariaLabel}
      disabled={disabled}
      onchange={handleChange}
    />
    <svg
      class="check-icon"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <path pathLength="1" d="M2.85 8.2L6.3 11.45L13.15 4.65" />
    </svg>
    <svg
      class="dash-icon"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3.5 8 L12.5 8" />
    </svg>
  </span>
  {#if hasLabel}
    <div class="label-content">
      <span class="main-label">{label}</span>
      {#if sublabel}
        <span class="sub-label">{sublabel}</span>
      {/if}
    </div>
  {/if}
</label>

<style>
  label {
    display: flex;
    align-items: flex-start;
    cursor: pointer;
    gap: 8px;
    padding: 4px 0;
  }

  label.disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  label.disabled .check {
    cursor: not-allowed;
  }

  label.noLabel {
    padding: 0;
    gap: 0;
  }

  label.compact {
    align-items: center;
    gap: 8px;
    padding: 2px 0;
  }

  .check-wrap {
    --check-size: 16px;
    --check-icon-size: 10px;
    --check-stroke: 2.2px;
    position: relative;
    display: inline-flex;
    width: var(--check-size);
    height: var(--check-size);
    margin-top: 1px;
    flex-shrink: 0;
  }

  .check-wrap.compact,
  label.noLabel .check-wrap {
    margin-top: 0;
  }

  .check-wrap.size-xs {
    --check-size: 14px;
    --check-icon-size: 9px;
    --check-stroke: 2px;
  }

  .check {
    appearance: none;
    cursor: pointer;
    width: 100%;
    height: 100%;
    margin: 0;
    background: var(--c-white);
    border: 1px solid var(--c-border);
    border-radius: var(--rounded);
    box-sizing: border-box;
    transition:
      background-color var(--transition-fast) ease,
      border-color var(--transition-fast) ease,
      box-shadow var(--transition-fast) ease,
      transform var(--transition-fast) ease;
  }

  .check:hover {
    border-color: var(--c-midgrey);
  }

  .check:checked {
    background: var(--c-brand);
    border-color: var(--c-brand);
  }

  .check:active {
    transform: scale(0.96);
  }

  .check:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--c-brand) 35%, transparent);
    outline-offset: 2px;
  }

  .check-icon {
    position: absolute;
    top: 50%;
    left: 50%;
    width: var(--check-icon-size);
    height: var(--check-icon-size);
    pointer-events: none;
    opacity: 0;
    transform: translate(-50%, -50%);
  }

  .check-icon path {
    fill: none;
    stroke: var(--c-white);
    stroke-width: var(--check-stroke);
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }

  .check:checked + .check-icon {
    opacity: 1;
  }

  /* Indeterminate = "Mixed" across a multi-selection: filled box with a dash. */
  .check:indeterminate {
    background: var(--c-brand);
    border-color: var(--c-brand);
  }

  .dash-icon {
    position: absolute;
    top: 50%;
    left: 50%;
    width: var(--check-icon-size);
    height: var(--check-icon-size);
    pointer-events: none;
    opacity: 0;
    transform: translate(-50%, -50%);
  }

  .dash-icon path {
    fill: none;
    stroke: var(--c-white);
    stroke-width: var(--check-stroke);
    stroke-linecap: round;
  }

  .check:indeterminate ~ .dash-icon {
    opacity: 1;
  }

  .label-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
  }

  .main-label {
    font-weight: 500;
    color: var(--c-black);
    line-height: var(--leading-normal);
  }

  label.compact .main-label {
    font-size: var(--text-xs);
    font-family: var(--font-small);
    color: var(--c-darkgrey);
    font-weight: 400;
    line-height: var(--leading-tight);
    letter-spacing: 0.01em;
  }

  .sub-label {
    font-size: var(--text-md);
    color: var(--c-darkgrey);
    line-height: var(--leading-normal);
    margin-top: 2px;
  }

  label.compact .label-content {
    gap: 1px;
  }

  label.compact .sub-label {
    margin-top: 0;
    font-size: var(--text-2xs);
    font-family: var(--font-small);
    line-height: var(--leading-tight);
  }
</style>
