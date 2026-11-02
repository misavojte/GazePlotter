<script lang="ts">
  import InputScaffold from './InputScaffold.svelte'
  import { ColorPicker, ColorPickerState } from '$lib/color'
  import { getContrastTextColor, detectColorFormat } from '$lib/color'
  import { untrack } from 'svelte'
  import { fade } from 'svelte/transition'
  import { useTooltipAction } from '$lib/tooltip'

  /**
   * Color picker input component wrapper.
   * Uses ColorPickerState for decoupled popup and positioning logic.
   */

  interface Props {
    value?: string
    label: string
    id?: string
    width?: number
    showLabel?: boolean
    ariaLabel?: string
    compact?: boolean
    /** Multi-selection "Mixed": the bound plots disagree on this color. Shows a
     *  neutral "Mixed" swatch; picking a color applies it to all. */
    mixed?: boolean
    /** The colors they disagree on: the Mixed swatch shows them as stripes. */
    mixedColors?: readonly string[]
    oninput?: (event: CustomEvent<string>) => void
  }

  let {
    value = $bindable('#000000'),
    label,
    id,
    width = $bindable(125),
    showLabel = true,
    ariaLabel,
    compact = false,
    mixed = false,
    mixedColors = [],
    oninput = () => {},
  }: Props = $props()

  const tooltipAction = useTooltipAction()

  /** Hard stops, one band per color: no in-between color nobody chose. */
  const MAX_STRIPES = 6
  const stripes = $derived.by(() => {
    const colors = mixedColors.filter(c => detectColorFormat(c) !== 'invalid').slice(0, MAX_STRIPES)
    if (!mixed || colors.length < 2) return null
    const w = 100 / colors.length
    return `linear-gradient(to right, ${colors.map((c, i) => `${c} ${i * w}% ${(i + 1) * w}%`).join(', ')})`
  })

  // Controller for the color picker popup logic
  const picker = new ColorPickerState()

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

  const generatedId = untrack(() => `color-${crypto.randomUUID()}`)
  const inputId = $derived(id ?? generatedId)
</script>

<InputScaffold
  {label}
  id={inputId}
  showLabel={showLabel}
  compact={compact}
>
  <div class="color-input-container">
    <button
      id={inputId}
      type="button"
      class="color-preview"
      class:compact={compact}
      onclick={() => picker.toggle()}
      aria-label={ariaLabel ?? (!showLabel ? label : undefined)}
      class:mixed={mixed && !stripes}
      style:background-color={mixed ? 'var(--c-lightgrey)' : formatColorValue}
      style:background-image={stripes}
      style:width="{actualWidth}px"
      bind:this={picker.triggerElement}
      use:tooltipAction={{
        content: `Mixed: ${mixedColors.length} colors. Picking a color applies it to all.`,
        disabled: !stripes,
      }}
    >
      <!-- Stripes speak for themselves; the label is for the plain grey swatch. -->
      {#if mixed && !stripes}
        <span class="color-value mixed-label">Mixed</span>
      {:else if !mixed && showHexCode}
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
    padding: 8px;
    border: 1px solid var(--c-border);
    border-radius: var(--rounded-md);
    font-size: var(--text-lg);
    height: 34px;
    cursor: pointer;
    background-color: white;
    /* Mixed stripes span the border box, or they repeat under the border. */
    background-origin: border-box;
    transition: all var(--transition-normal);
  }

  .color-preview.compact {
    height: 24px;
    font-size: var(--text-2xs);
    font-family: var(--font-small);
    padding: 0 4px;
    border-radius: var(--rounded);
  }

  .color-preview:hover {
    border-color: var(--c-darkgrey);
  }

  .color-value {
    font-family: monospace;
    font-size: var(--text-md);
    font-weight: 500;
    text-align: center;
    flex-grow: 1;
  }

  .color-preview.mixed {
    border-style: dashed;
  }

  .mixed-label {
    font-family: inherit;
    font-size: var(--text-xs);
    color: var(--c-darkgrey);
  }

  .color-popup {
    padding: 10px;
    background-color: white;
    border-radius: var(--rounded-md);
    box-shadow: var(--shadow-lg);
    z-index: 9999;
    width: 210px;
    overflow-y: auto;
    max-height: 90vh;
  }
</style>
