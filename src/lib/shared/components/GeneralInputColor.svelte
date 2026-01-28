<script lang="ts">
  import GeneralInputScaffold from '$lib/shared/components/GeneralInputScaffold.svelte'
  import ColorPicker from '$lib/color/ColorPicker.svelte'
  import { getContrastTextColor, detectColorFormat } from '$lib/color/utility'
  import { tick, untrack } from 'svelte'
  import { fade } from 'svelte/transition'

  /**
   * Color picker input component wrapper
   * A customizable color picker input that uses the HSV model ColorPicker
   */

  interface Props {
    value?: string
    label: string
    width?: number
    oninput?: (event: CustomEvent<string>) => void
  }

  let {
    value = $bindable('#000000'),
    label,
    width = $bindable(125),
    oninput = () => {},
  }: Props = $props()

  // Ensure minimum width constraint is met
  const actualWidth = $derived(Math.max(35, width))

  // Determine if there's enough space to display the hex code
  const showHexCode = $derived(actualWidth >= 100)

  // State for color picker popup
  let isOpen = $state(false)
  let triggerElement: HTMLButtonElement | null = $state(null)
  let popupElement: HTMLDivElement | null = $state(null)

  // State for popup positioning
  let popupPosition = $state({ top: 0, left: 0 })

  // Create a portal for the color popup with click-outside behavior
  const portal = (node: HTMLElement) => {
    // Move the node to the body
    document.body.appendChild(node)

    // Setup click outside listener
    const handleClickOutside = (event: MouseEvent) => {
      // Check if the click was outside the popup and not on the trigger button
      if (
        node &&
        !node.contains(event.target as Node) &&
        triggerElement !== event.target &&
        !triggerElement?.contains(event.target as Node)
      ) {
        isOpen = false
      }
    }

    // Add listeners with a small delay to prevent immediate closing
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)

    // Return destroy function for cleanup
    return {
      destroy() {
        document.removeEventListener('mousedown', handleClickOutside)
        if (node.parentNode) {
          node.parentNode.removeChild(node)
        }
      },
    }
  }

  // Calculate position for the popup - only once when opening
  const calculatePopupPosition = async () => {
    if (!triggerElement) return

    // Wait for DOM update
    await tick()

    const triggerRect = triggerElement.getBoundingClientRect()

    // Calculate position relative to viewport (for fixed positioning)
    let top = triggerRect.bottom + 5
    let left = triggerRect.left

    // Check if popup would go off the right edge
    if (popupElement) {
      const popupWidth = popupElement.offsetWidth
      if (left + popupWidth > window.innerWidth - 10) {
        left = window.innerWidth - popupWidth - 10
      }

      // Check if popup would go off the bottom edge
      const popupHeight = popupElement.offsetHeight
      if (top + popupHeight > window.innerHeight - 10) {
        // Position above the trigger if it would go off the bottom
        top = Math.max(10, triggerRect.top - popupHeight - 5)
      }
    }

    popupPosition = { top, left }
  }

  // Toggle color picker
  const toggleColorPicker = async () => {
    isOpen = !isOpen
    if (isOpen) {
      // Calculate position once when opening
      await calculatePopupPosition()
    }
  }

  // Handle color picker input
  const handleColorInput = (newColor: string) => {
    value = newColor
    oninput(new CustomEvent('input', { detail: newColor }))
  }

  // Format color value for display
  const formatColorValue = $derived(
    detectColorFormat(value) === 'invalid' ? '#000000' : value
  )

  // Calculate contrast text color for better readability
  const contrastTextColor = $derived(getContrastTextColor(formatColorValue))

  const id = `color-${untrack(() => label.toLowerCase().replace(/\s+/g, '-'))}`
</script>

<GeneralInputScaffold {label} {id}>
  <div class="color-input-container">
    <button
      type="button"
      class="color-preview"
      onclick={toggleColorPicker}
      style:background-color={formatColorValue}
      style:width="{actualWidth}px"
      bind:this={triggerElement}
    >
      {#if showHexCode}
        <span class="color-value" style:color={contrastTextColor}>
          {formatColorValue}
        </span>
      {/if}
    </button>

    {#if isOpen}
      <div
        use:portal
        class="color-popup"
        style:position="fixed"
        style:top="{popupPosition.top}px"
        style:left="{popupPosition.left}px"
        bind:this={popupElement}
        in:fade={{ duration: 100 }}
        out:fade={{ duration: 100 }}
      >
        <ColorPicker {value} oninput={handleColorInput} />
      </div>
    {/if}
  </div>
</GeneralInputScaffold>

<style>
  .color-input-container {
    position: relative;
  }

  .color-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 0.5rem;
    border: 1px solid var(--c-border);
    border-radius: var(--rounded);
    font-size: 14px;
    height: 34px;
    cursor: pointer;
    background-color: white;
    transition: all 0.2s;
  }

  .color-preview:hover {
    border-color: #666;
  }

  .color-value {
    font-family: monospace;
    font-size: 13px;
    font-weight: 500;
    text-align: center;
    flex-grow: 1;
  }

  .color-popup {
    padding: 6px;
    background-color: white;
    border-radius: var(--rounded);
    box-shadow: 0 3px 15px rgba(0, 0, 0, 0.3);
    z-index: 9999;
    width: 200px;
    overflow-y: auto;
    max-height: 90vh;
  }
</style>
