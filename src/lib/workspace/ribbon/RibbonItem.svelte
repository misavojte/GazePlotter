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

  let iconElement: HTMLDivElement | null = $state(null)

  function handleClick() {
    if (disabled) return

    if (iconElement) {
      iconElement.style.transform = 'scale(0.85)'
      setTimeout(() => {
        if (iconElement) {
          iconElement.style.transform = 'scale(1)'
        }
      }, 100)
    }

    action()
  }
</script>

<button
  class="ribbon-item"
  class:disabled
  onclick={handleClick}
  {disabled}
  aria-label={label}
  use:tooltipAction={{
    content: label,
    position: 'bottom',
  }}
>
  <div class="ribbon-item-icon" bind:this={iconElement}>
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
    border-radius: 6px;
    color: var(--c-darkgrey, #666);
    background: transparent;
    border: none;
    transition: all 0.15s ease-out;
    gap: 4px;
    font-family: inherit;
  }

  .ribbon-item:hover:not(.disabled) {
    background-color: var(--c-midgrey, #e0e0e0);
    color: var(--c-black);
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
    transition: transform 0.1s ease;
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
  }
</style>
