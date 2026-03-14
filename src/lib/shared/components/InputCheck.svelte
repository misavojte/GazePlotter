<script lang="ts">
  interface Props {
    label: string
    sublabel?: string
    checked?: boolean
    size?: 'xs' | 'sm' | 'md' | 'lg'
    appearance?: 'default' | 'compact'
    id?: string
    ariaLabel?: string
    onchange?: (event: CustomEvent) => void
  }
  import { untrack } from 'svelte'

  let {
    label,
    sublabel,
    checked = $bindable(false),
    size = 'sm',
    appearance = 'default',
    id,
    ariaLabel,
    onchange = () => {},
  }: Props = $props()

  const generatedId = untrack(() => `check-${crypto.randomUUID()}`)
  const inputId = $derived(id ?? generatedId)

  const hasLabel = $derived(!!label || !!sublabel)

  function handleChange(event: Event) {
    const target = event.currentTarget as HTMLInputElement
    checked = target.checked
    onchange(new CustomEvent('change', { detail: target.checked }))
  }
</script>

<label class:noLabel={!hasLabel} class:compact={appearance === 'compact'}>
  <span class={`check-wrap size-${size}`} class:compact={appearance === 'compact'}>
    <input
      type="checkbox"
      class="check"
      id={inputId}
      {checked}
      aria-label={ariaLabel}
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
    gap: 0.5rem;
    padding: 0.25rem 0;
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
    margin-top: 0.05rem;
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

  .check-wrap.size-sm {
    --check-size: 16px;
    --check-icon-size: 10px;
    --check-stroke: 2.2px;
  }

  .check-wrap.size-md {
    --check-size: 24px;
    --check-icon-size: 13px;
    --check-stroke: 2.25px;
  }

  .check-wrap.size-lg {
    --check-size: 34px;
    --check-icon-size: 16px;
    --check-stroke: 2.35px;
  }

  .check-wrap.size-lg .check {
    border-radius: var(--rounded-md);
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
      background-color 140ms ease,
      border-color 140ms ease,
      box-shadow 140ms ease,
      transform 160ms ease;
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

  .label-content {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    flex: 1;
  }

  .main-label {
    font-weight: 500;
    color: var(--c-black);
    line-height: 1.4;
  }

  label.compact .main-label {
    font-size: 11px;
    color: var(--c-darkgrey);
    font-weight: 400;
    line-height: 1.2;
    letter-spacing: 0.01em;
  }

  .sub-label {
    font-size: 0.8rem;
    color: var(--c-darkgrey);
    line-height: 1.3;
    margin-top: 0.1rem;
  }

  label.compact .sub-label {
    margin-top: 0;
  }
</style>
