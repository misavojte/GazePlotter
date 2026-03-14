<script lang="ts">
  import { scale } from 'svelte/transition'
  interface Props {
    label: string
    sublabel?: string
    checked?: boolean
    size?: 'sm' | 'md' | 'lg'
    ariaLabel?: string
    onchange?: (event: CustomEvent) => void
  }

  let {
    label,
    sublabel,
    checked = $bindable(false),
    size = 'sm',
    ariaLabel,
    onchange = () => {},
  }: Props = $props()

  const hasLabel = $derived(!!label || !!sublabel)

  function handleChange(event: Event) {
    const target = event.target as HTMLInputElement
    checked = target.checked // Update the bound value
    onchange(new CustomEvent('change', { detail: target.checked }))
  }
</script>

<label class:noLabel={!hasLabel}>
  <span class="check-wrap">
    <input
      type="checkbox"
      class={`check size-${size}`}
      {checked}
      aria-label={ariaLabel}
      onchange={handleChange}
    />
    {#if checked}
      <svg
        class="check-icon"
        viewBox="0 0 20 20"
        aria-hidden="true"
        focusable="false"
        in:scale={{ duration: 200, start: 0.3 }}
        out:scale={{ duration: 150, start: 0.3 }}
      >
        <path d="M5 10.5l3.5 3.5L15 7" />
      </svg>
    {/if}
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

  label.noLabel .check-wrap {
    margin-top: 0;
  }

  .check-wrap {
    position: relative;
    display: inline-grid;
    place-items: center;
    margin-top: 0.05rem;
    flex-shrink: 0;
  }

  input[type='checkbox'] {
    cursor: pointer;
    appearance: none;
    background: var(--c-white);
    border: 1px solid var(--c-border);
    border-radius: 4px;
    margin: 0;
    transition:
      background-color 120ms ease,
      border-color 120ms ease,
      box-shadow 120ms ease;
  }

  input[type='checkbox']:checked {
    background: var(--c-brand);
    border-color: var(--c-brand);
  }

  .check-icon {
    position: absolute;
    width: 60%;
    height: 60%;
    stroke: var(--c-white);
    stroke-width: 1.5;
    fill: none;
    pointer-events: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  input[type='checkbox']:focus-visible {
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--c-brand) 35%, transparent);
  }

  input[type='checkbox'].size-sm {
    width: 16px;
    height: 16px;
  }

  input[type='checkbox'].size-md {
    width: 24px;
    height: 24px;
  }

  input[type='checkbox'].size-lg {
    width: 34px;
    height: 34px;
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

  .sub-label {
    font-size: 0.8rem;
    color: var(--c-darkgrey);
    line-height: 1.3;
    margin-top: 0.1rem;
  }
</style>
