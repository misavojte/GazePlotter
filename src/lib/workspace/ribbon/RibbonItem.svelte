<script lang="ts">
  import type { LucideIconComponent } from '$lib/shared/types'
  import { tooltipAction } from '$lib/tooltip'

  interface Props {
    label: string
    shortLabel: string
    icon: LucideIconComponent
    action: () => void
    disabled?: boolean
  }

  let {
    label,
    shortLabel,
    icon: Icon,
    action,
    disabled = false,
  }: Props = $props()

  // Press-feedback (icon scale-down) is pure CSS — see the
  // `.ribbon-item:active ... .ribbon-item-icon` rule in the stylesheet.
  // The button's `disabled` attribute suppresses clicks at the platform
  // level, so no JS guard is needed.
</script>

<button
  class="ribbon-item"
  class:disabled
  onclick={action}
  {disabled}
  aria-label={label}
  use:tooltipAction={{
    content: label,
    position: 'bottom',
  }}
>
  <div class="ribbon-item-icon">
    <Icon size={16} strokeWidth={1.75} />
  </div>
  <span class="ribbon-item-label">{shortLabel}</span>
</button>

<style>
  .ribbon-item {
    cursor: pointer;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 48px;
    height: 38px;
    padding: 4px;
    border-radius: var(--rounded-md);
    color: var(--c-darkgrey);
    background: transparent;
    border: none;
    transition: all var(--transition-fast) ease-out;
    gap: 4px;
    font-family: inherit;
  }

  .ribbon-item:hover:not(.disabled) {
    background-color: var(--c-midgrey);
    color: var(--c-black);
  }

  .ribbon-item:hover:not(.disabled) .ribbon-item-icon {
    transform: scale(1.05);
  }

  .ribbon-item.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .ribbon-item-icon {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform var(--transition-fast) ease;
  }

  .ribbon-item:active:not(.disabled) .ribbon-item-icon {
    transform: scale(0.85);
  }

  .ribbon-item-label {
    display: block;
    font-family: inherit;
    font-size: 8px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: inherit;
    user-select: none;
    -webkit-font-smoothing: antialiased;
    text-align: center;
    line-height: 1;
    margin-top: 1px;
  }
</style>
