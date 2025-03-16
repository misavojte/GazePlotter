<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { melt, createTooltip } from '@melt-ui/svelte'
  import { fade } from 'svelte/transition'
  import { derived, writable } from 'svelte/store'

  // Props for the toolbar item
  interface Props {
    id: string;
    label: string;
    icon: string;
    action?: (() => void) | null;
    useDropdown?: boolean;
    dropdownTrigger?: any;
  }

  let {
    id,
    label,
    icon,
    action = null,
    useDropdown = false,
    dropdownTrigger = null
  }: Props = $props();

  // Create a store to track whether the dropdown is open
  const isDropdownOpen = writable(false)

  // Create tooltip with proper configuration
  const {
    elements: {
      trigger: tooltipTrigger,
      content: tooltipContent,
      arrow: tooltipArrow,
    },
    states: { open: tooltipOpen },
  } = createTooltip({
    positioning: {
      placement: 'right',
      gutter: 13,
    },
    openDelay: 300,
    closeDelay: 100,
    portal: true,
    // Disable the tooltip when dropdown is open
    disabled: derived(isDropdownOpen, $isOpen => useDropdown && $isOpen),
  })

  // Watch for dropdown state changes
  onMount(() => {
    if (useDropdown && dropdownTrigger) {
      // Get the actual dropdown store
      const dropdownOpenStore = dropdownTrigger?.open

      if (dropdownOpenStore) {
        // Set up a subscription to update our local state
        const unsubscribe = dropdownOpenStore.subscribe(value => {
          isDropdownOpen.set(value)

          // When dropdown opens, ensure tooltip is closed
          if (value) {
            tooltipOpen.set(false)
          }
        })

        return unsubscribe
      }
    }
  })

  // Event dispatcher
  const dispatch = createEventDispatcher()

  // Handle item click
  function handleClick(event) {
    if (action) {
      action()
    }

    if (!useDropdown) {
      dispatch('click', { id, event })
    }
  }
</script>

{#if useDropdown}
  <!-- Wrapper div with tooltip -->
  <div class="tooltip-wrapper" use:melt={$tooltipTrigger}>
    <!-- Button with dropdown -->
    <button class="toolbar-item" use:melt={dropdownTrigger}>
      <div class="toolbar-item-icon">
        {@html icon}
      </div>
    </button>

    {#if $tooltipOpen}
      <div
        class="tooltip"
        use:melt={$tooltipContent}
        transition:fade={{ duration: 150 }}
      >
        <div use:melt={$tooltipArrow} class="tooltip-arrow"></div>
        {label}
      </div>
    {/if}
  </div>
{:else}
  <div class="tooltip-wrapper">
    <button
      class="toolbar-item"
      use:melt={$tooltipTrigger}
      onclick={handleClick}
    >
      <div class="toolbar-item-icon">
        {@html icon}
      </div>
    </button>

    {#if $tooltipOpen}
      <div
        class="tooltip"
        use:melt={$tooltipContent}
        transition:fade={{ duration: 150 }}
      >
        <div use:melt={$tooltipArrow} class="tooltip-arrow"></div>
        {label}
      </div>
    {/if}
  </div>
{/if}

<style>
  .tooltip-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toolbar-item {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    margin: 4px 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--c-darkgrey, #666);
    cursor: pointer;
    transition: all 0.2s ease;
    padding: 0;
  }

  .toolbar-item:hover {
    background-color: var(--c-lightgrey, #eaeaea);
    color: var(--c-primary);
  }

  .toolbar-item-icon {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tooltip {
    z-index: 2500;
    background-color: var(--c-darkgrey);
    color: white;
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 12px;
    line-height: 1.5;
    white-space: nowrap;
    pointer-events: none;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  }

  .tooltip-arrow {
    position: absolute;
    width: 8px;
    height: 8px;
    background-color: var(--c-darkgrey);
    transform: rotate(45deg);
    left: -4px;
    pointer-events: none;
  }
</style>
