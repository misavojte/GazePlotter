<script lang="ts">
  import InputScaffold from './InputScaffold.svelte'
  import { ColorPicker, ColorPickerManager } from '$lib/color'
  import { getContrastTextColor, detectColorFormat } from '$lib/color/utility'
  import { untrack } from 'svelte'
  import { fade } from 'svelte/transition'

  /**
   * Color picker input component wrapper.
   * Uses ColorPickerManager for decoupled popup and positioning logic.
   */

  interface Props {
    value?: string
    label: string
    id?: string
    width?: number
    showLabel?: boolean
    ariaLabel?: string
    oninput?: (event: CustomEvent<string>) => void
  }

  let {
    value = $bindable('#000000'),
    label,
    id,
    width = $bindable(125),
    showLabel = true,
    ariaLabel,
    oninput = () => {},
  }: Props = $props()

  // Controller for the color picker popup logic
  const picker = new ColorPickerManager()

  // Ensure minimum width constraint is met
  const actualWidth = $derived(Math.max(35, width))

  // Determine if there's enough space to display the hex code
  const showHexCode = $derived(actualWidth >= 100)

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

  const generatedId = `color-${untrack(() => label.toLowerCase().replace(/\s+/g, '-'))}`
  const inputId = $derived(id ?? generatedId)
</script>

<InputScaffold
  {label}
  id={inputId}
  showLabel={showLabel}
>
  <div class="color-input-container">
    <button
      id={inputId}
      type="button"
      class="color-preview"
      onclick={() => picker.toggle()}
      aria-label={ariaLabel ?? (!showLabel ? label : undefined)}
      style:background-color={formatColorValue}
      style:width="{actualWidth}px"
      bind:this={picker.triggerElement}
    >
      {#if showHexCode}
        <span class="color-value" style:color={contrastTextColor}>
          {formatColorValue}
        </span>
      {/if}
    </button>

    {#if picker.isOpen}
      <div
        use:picker.portal
        class="color-popup"
        style:position="fixed"
        style:top="{picker.position.top}px"
        style:left="{picker.position.left}px"
        bind:this={picker.popupElement}
        in:fade={{ duration: 100 }}
        out:fade={{ duration: 100 }}
      >
        <ColorPicker {value} oninput={handleColorInput} />
      </div>
    {/if}
  </div>
</InputScaffold>

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
    border-radius: var(--rounded-md);
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
    padding: 10px;
    background-color: white;
    border-radius: var(--rounded-md);
    box-shadow: 0 3px 15px rgba(0, 0, 0, 0.3);
    z-index: 9999;
    width: 210px;
    overflow-y: auto;
    max-height: 90vh;
  }
</style>
